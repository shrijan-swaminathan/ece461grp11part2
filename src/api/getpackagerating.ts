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
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("ID is required")
            }
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
                body: JSON.stringify("Package does not exist")
            };
        }
        const rating = response.Item.Rating;
        // remove URL field from rating
        if (rating){
            delete rating.URL;
        }
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(rating)
        };
    } catch (error: any) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(error.message)
        };
    }
}