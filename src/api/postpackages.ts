import { APIGatewayProxyResult, APIGatewayProxyEventQueryStringParameters } from 'aws-lambda';
import { PackageQuery, PackageMetadata } from './types.js';
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { isValidName } from './helperfunctions/isvalidname.js';
import * as semver from "semver";

/**
 * POST /packages - Fetches packages from the database based on the queries provided in the body
 * @param tableName - The name of the DynamoDB table
 * @param queryStringParameters - The query string parameters (containing the offset)
 * @param bodycontent - The body of the request
 * @param dynamoClient - The DynamoDB client
 * @returns The APIGatewayProxyResult
 * @throws Error if missing fields in PackageQuery, or it is formatted incorrectly, or is invalid
**/

export async function postpackages(
    tableName: string, 
    queryStringParameters: APIGatewayProxyEventQueryStringParameters,
    bodycontent: any, 
    dynamoClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
    try {
        if (!bodycontent) {
            throw new Error("Package data is required");
        }
        let queries: PackageQuery[] = JSON.parse(bodycontent);
        if (!Array.isArray(queries)) {
            // turn single query into array
            queries = [queries];
        }
        const itemsperpage = 10;
        // get offset value from queryStringParameters
        const offset = queryStringParameters?.offset && !isNaN(parseInt(queryStringParameters.offset)) ? 
            queryStringParameters.offset : undefined;
        const startIndex = offset ? parseInt(offset) - 1 : 0;
        let searchResults: PackageMetadata[] = [];
        // Handle wildcard query
        if (queries.some(query => query.Name === '*')) {
            const command = new ScanCommand({
                TableName: tableName
            });
            const allPackages = await dynamoClient.send(command);
            searchResults = allPackages.Items?.map(pkg => {
                return {
                    Name: pkg.Name,
                    Version: pkg.Version,
                    ID: pkg.ID,
                };
            }) || [];
            if (searchResults.length === 0) {
                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                    },
                    body: JSON.stringify(searchResults)
                };
            }
            // sort searchResults by name and then by version
            searchResults?.sort((a, b) => {
                if (a.Name < b.Name) return -1;
                if (a.Name > b.Name) return 1;
                return semver.compare(a.Version, b.Version);
            });
            const paginatedResults = searchResults?.slice(startIndex, startIndex + itemsperpage);
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'offset': startIndex + itemsperpage < searchResults.length ? (startIndex + itemsperpage).toString() : ''
                },
                body: JSON.stringify(paginatedResults)
            };
        }

        // Process each query in the array
        for (const query of queries) {
            let { Version: versionRange, Name: name } = query;
            // check if version name is a bounded range
            if (versionRange && versionRange.includes('-')) {
                const [minVersion, maxVersion] = versionRange.split('-').map(v => v.trim());
                
                if (semver.valid(minVersion) && semver.valid(maxVersion)) {
                    // Use semver range syntax that is guaranteed to be valid
                    versionRange = `>=${minVersion} <${maxVersion}`;
                }
            }
            if (versionRange && !semver.validRange(versionRange)) {
                continue;
            }
            
            if (!name) {
                continue;
            }

            if (!isValidName(name)) {
                continue;
            }

            const command = new ScanCommand({
                TableName: tableName,
                FilterExpression: '#name = :name',
                ExpressionAttributeNames: {
                    '#name': 'Name'
                },
                ExpressionAttributeValues: {
                    ':name': name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
                }
            });

            const matchingPackages = await dynamoClient.send(command);
            
            if (matchingPackages.Items && matchingPackages.Items.length > 0) {
                // Filter by version if specified
                if (versionRange) {
                    const filteredPackages = matchingPackages.Items.filter(pkg => {
                        return semver.satisfies(pkg.Version, versionRange) || semver.eq(pkg.Version, versionRange);
                    })
                    .map(pkg => {
                        return {
                            Version: pkg.Version,
                            Name: pkg.Name,
                            ID: pkg.ID,
                        };
                    });
                    
                    searchResults.push(...filteredPackages as PackageMetadata[]);
                }
                else {
                    searchResults.push(...matchingPackages.Items.map(pkg => {
                        return {
                            Version: pkg.Version,
                            Name: pkg.Name,
                            ID: pkg.ID,
                        };
                    }));
                }
            }
        }

        if (searchResults.length === 0) {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'offset': ''
                },
                body: JSON.stringify(searchResults)
            };
        }
        // Remove duplicates
        searchResults = searchResults.filter((pkg, index, self) =>
            index === self.findIndex(p => (
                p.Name === pkg.Name && p.Version === pkg.Version
            ))
        );

        // sort searchResults by name and then by version
        searchResults.sort((a, b) => {
            if (a.Name < b.Name) return -1;
            if (a.Name > b.Name) return 1;
            return semver.compare(a.Version, b.Version);
        });
        // get paginated results
        if (startIndex >= searchResults.length || startIndex < 0) {
            throw new Error('Invalid offset value');
        }
        const paginatedResults = searchResults.slice(startIndex, startIndex + itemsperpage);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'offset': startIndex + itemsperpage < searchResults.length ? (startIndex + itemsperpage).toString() : ''
            },
            body: JSON.stringify(paginatedResults)
        };
    }
    catch (error: any) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(error.message)
        };
    }
}