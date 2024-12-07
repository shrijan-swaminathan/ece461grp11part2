import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { PackageCost } from './types.js';

/**
 * Fetches the cost of a package from S3, including its dependencies
 * @param id - The ID of the package
 * @param s3Client - The S3 client
 * @param bucketName - The name of the S3 bucket
 * @returns The metadata of the package
 * @throws Error if the package is not found
 */


const fetchMetadataFromS3 = async (
  id: string,
  s3Client: S3Client,
  bucketName: string
): Promise<any> => {
  const metadataKey = `${id}/metadata.json`;

  try {
    const metadataObject = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: metadataKey,
      })
    );

    const metadataBody = await metadataObject.Body?.transformToString();
    return JSON.parse(metadataBody || "{}");
  } catch (error) {
    throw new Error(`Package ID "${id}" not found.`);
  }
};

const calculateCostRecursive = async (
  id: string,
  s3Client: S3Client,
  bucketName: string
): Promise<number> => {
  const metadata = await fetchMetadataFromS3(id, s3Client, bucketName);

  const standaloneCost = metadata.size || 25.0; 
  const dependencies = metadata.dependencies || [];

  if (dependencies.length === 0) {
    return standaloneCost;
  }

  // Recursive case: Sum costs of all dependencies
  const dependenciesCost = await Promise.all(
    dependencies.map((dep: { id: string }) =>
      calculateCostRecursive(dep.id, s3Client, bucketName)
    )
  );

  return standaloneCost + dependenciesCost.reduce((sum, cost) => sum + cost, 0);
};

export const getPackageCost = async (
  id: string,
  dependency: boolean,
  s3Client: S3Client,
  bucketName: string
): Promise<any> => {
  try {
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify("Package ID is required."),
      };
    }

    const standaloneCost = await calculateCostRecursive(id, s3Client, bucketName);
    const totalCost = dependency ? standaloneCost : standaloneCost;

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
