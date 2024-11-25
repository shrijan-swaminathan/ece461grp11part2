import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { APIGatewayProxyResult } from 'aws-lambda';

export async function deleteAllObjects(curr_bucket: string, s3Client: S3Client): Promise<APIGatewayProxyResult> {
  try {
    // List all objects in the bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: curr_bucket
    });
    
    const { Contents } = await s3Client.send(listCommand);
    
    if (!Contents || Contents.length === 0) {
      return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify("Registry reset.")
      }
    }

    // Create delete command with all objects
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: curr_bucket,
      Delete: {
        Objects: Contents.map(({ Key }) => ({ Key }))
      }
    });

    // Delete all objects
    await s3Client.send(deleteCommand);

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