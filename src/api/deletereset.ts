import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand} from "@aws-sdk/lib-dynamodb";

/**
 * Deletes all objects in the bucket and resets the registry.
 * @param tableName - The name of the table in DynamoDB.
 * @param curr_bucket - The name of the bucket in S3.
 * @param s3Client - The S3 client.
 * @param dynamoClient - The DynamoDB client.
 * 
 * @returns The APIGatewayProxyResult.
 * 
 * @throws Error if there is an error while resetting the registry.
 * 
 */
export async function deleteAllObjects(
  tableName: string, 
  curr_bucket: string, 
  s3Client: S3Client, 
  dynamoClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  try {
    // List all objects in the bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: curr_bucket
    });
    
    const { Contents } = await s3Client.send(listCommand);
    
    if (!Contents || Contents.length === 0) {
      // do nothing
    }
    else{
      // Create delete command with all objects
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: curr_bucket,
        Delete: {
          Objects: Contents.map(({ Key }) => ({ Key }))
        }
      });

      // Delete all objects
      await s3Client.send(deleteCommand);
    }
    const command = new ScanCommand({
      TableName: tableName,
    });

    const anyItems = await dynamoClient.send(command);
    if (!anyItems.Items || anyItems.Items.length == 0){
      return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify("Registry is rest.")
      }
    }
    else{
      const deleteRequests = anyItems.Items.map(item => ({
        DeleteRequest: {
          Key: {
            'ID': item.ID
          }
        }
      }));

      for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        const batchWriteCommand = new BatchWriteCommand({
            RequestItems: {
                [tableName]: batch
            }
        });
        await dynamoClient.send(batchWriteCommand);
      }  
    }
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify("Registry is reset.")
    }
  } catch (error) {
    return{
        statusCode: 500,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify("Error while resetting the registry.")
    }
  }
}