import { APIGatewayProxyResult } from 'aws-lambda';
import { PackageQuery, PackageMetadata } from './types';
import { PutCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import * as semver from "semver";

export async function postpackages(
    tableName: string, 
    bodycontent: any, 
    dynamoClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
    try {
        const queries: PackageQuery[] = JSON.parse(bodycontent);
        const searchResults: PackageMetadata[] = [];

        // Handle wildcard query
        if (queries[0].Name === '*') {
            const command = new ScanCommand({
                TableName: tableName
            });
            const allPackages = await dynamoClient.send(command);
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify(allPackages.Items)
            };
        }

        // Process each query in the array
        for (const query of queries) {
            const { Version: versionRange, Name: name } = query;
            
            if (!name) {
                throw new Error('Name is required');
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
                const filteredPackages = matchingPackages.Items.filter(pkg => {
                    if (!versionRange) return true;
                    return semver.satisfies(pkg.Version, versionRange);
                })
                .map(pkg => {
                    return {
                        Name: pkg.Name,
                        Version: pkg.Version,
                        ID: pkg.ID,
                    };
                });
                
                searchResults.push(...filteredPackages as PackageMetadata[]);
            }
        }

        if (searchResults.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("No packages found matching the queries")
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(searchResults)
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