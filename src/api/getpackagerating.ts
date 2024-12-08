import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

/**
 * GET /package/{id}/rating - Fetches the rating of a package from the database
 * @param tableName - The name of the DynamoDB table
 * @param id - The ID of the package
 * @param dynamoClient - The DynamoDB client
 * @returns The APIGatewayProxyResult
 * @throws Error if ID is missing
 **/

export async function getpackagerating(
    tableName: string, 
    id: string,
    dynamoClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
    try {
        const pkgId = id;
        if (!pkgId) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("ID is required")
            }
        }
        const command = new GetCommand({
            TableName: tableName,
            Key: {
                ID: pkgId
            }
        });
        const response = await dynamoClient.send(command);
        if (!response.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("Package does not exist")
            };
        }
        const rating = response?.Item.Ratings;
        // remove URL field from rating
        if (rating){
            delete rating.URL;
        }
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(rating)
        };
    } catch (error: any) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(error.message)
        };
    }
}