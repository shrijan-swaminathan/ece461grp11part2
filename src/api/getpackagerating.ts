import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

export async function getpackagerating(
    tableName: string, 
    queryStringParameters: APIGatewayProxyEventQueryStringParameters, 
    dynamoClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
    try {
        const id = queryStringParameters?.id;
        if (!id) {
            throw new Error("Package ID is required");
        }
        const command = new GetCommand({
            TableName: tableName,
            Key: {
                ID: id
            }
        });
        const response = await dynamoClient.send(command);
        if (!response.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify({ message: 'Package not found' })
            };
        }
        const rating = response.Item.Rating;
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({ rating })
        };
    } catch (error: any) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({ message: error.message })
        };
    }
}