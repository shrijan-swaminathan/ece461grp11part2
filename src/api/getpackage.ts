import { APIGatewayProxyResult } from 'aws-lambda';
import { GetObjectCommand} from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

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

        if (!packageName) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("Package does not exist")
            }
        }
        // get the package.zip
        const packageParams = {
            Bucket: curr_bucket,
            Key: `packages/${packageName}/${ID}/package.zip`
        };

        const packageData = await s3Client.send(new GetObjectCommand(packageParams));
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
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(error!.message)
        };
    }
}