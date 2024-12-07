import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { PackageCost } from './types.js';

export const getPackageCost = async (
  id: string,
  dependency: boolean,
  s3Client: S3Client,
  bucketName: string
): Promise<APIGatewayProxyResult> => {
  try {
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify("Package ID is required."),
      };
    }
    const metadataKey = `${id}/metadata.json`;

    const metadataObject = await s3Client
      .send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: metadataKey,
        })
      )
      .catch(() => {
        throw new Error(`Package ID "${id}" not found.`);
      });


    const metadataBody = await metadataObject.Body?.transformToString();
    const metadata = JSON.parse(metadataBody || "{}");

    const standaloneCost = metadata.size || 25.0; 
    const transitiveDependenciesCost = metadata.dependencies
      ? metadata.dependencies.reduce(
          (total: number, dep: any) => total + (dep.size || 10.0),
          0
        )
      : 0;
    const totalCost = dependency
      ? standaloneCost + transitiveDependenciesCost
      : standaloneCost;

    // Create cost response
    const costResponse: PackageCost = {
      standaloneCost,
      totalCost,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ [id]: costResponse }),
    };
  } catch (error: any) {
    console.error("Error fetching package cost:", error);
    return {
      statusCode: error.message.includes("not found") ? 404 : 500,
      body: JSON.stringify(error.message),
    };
  }
};
