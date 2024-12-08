import { APIGatewayProxyResult } from 'aws-lambda';
import { GetObjectCommand} from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

/**
 * GET /package/{id} - Fetches a package from the database and S3 bucket based on the ID
 * @param tableName - The name of the DynamoDB table
 * @param ID - The ID of the package to fetch
 * @param curr_bucket - The name of the S3 bucket
 * @param s3Client - The S3 client
 * @param dynamoClient - The DynamoDB client
 * @returns The APIGatewayProxyResult containing the package metadata and content
 * @throws Error if the package doesn't exist or if there's an error fetching the data
 */

export async function getPackage(
    tableName: string,
    ID: any, 
    curr_bucket: string, 
    s3Client: any, 
    dynamoClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
    try{
        const command = new GetCommand({
            TableName: tableName,
            Key: {
                'ID': ID
            }
        });

        const packagemetaData = await dynamoClient.send(command);
        const packageName = packagemetaData.Item?.Name;
        const packageURL = packagemetaData.Item?.URL;

        console.log("Fetching package with Name: ", packageName);
        if (!packageName) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("Package does not exist")
            }
        }
        // get the package.zip
        let packageData = null;
        if (!packageURL || packageURL.includes("github.com")) {
            let packageParams = {
                Bucket: curr_bucket,
                Key: `packages/${packageName}/${ID}/package.zip`
            };
            packageData = await s3Client.send(new GetObjectCommand(packageParams));
        }
        else{
            let packageParams = {
                Bucket: curr_bucket,
                Key: `packages/${packageName}/${ID}/package.tgz`
            };
            packageData = await s3Client.send(new GetObjectCommand(packageParams));
        }

        const content = await packageData.Body.transformToString('base64');

        const metadata = {
            Name: packagemetaData.Item?.Name,
            Version: packagemetaData.Item?.Version,
            ID: ID
        };

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                metadata: metadata,
                data: {
                    Content: content,
                    ...(packageURL && { URL: packageURL })
                }
            })
        };
    }
    catch (error: any) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(error!.message)
        };
    }
}