import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { PackageCost } from "./types.js";

const fetchMetadataFromDynamoDB = async (
  id: string,
  tableName: string,
  dynamoClient: DynamoDBDocumentClient
): Promise<any> => {
  const command = new GetCommand({
    TableName: tableName,
    Key: { ID: id },
  });

  const result = await dynamoClient.send(command);

  if (!result.Item) {
    throw new Error(`Package ID "${id}" not found.`);
  }

  return result.Item;
};

const calculateCostRecursive = async (
  id: string,
  tableName: string,
  dynamoClient: DynamoDBDocumentClient
): Promise<number> => {
  // Fetch metadata for the current package
  const metadata = await fetchMetadataFromDynamoDB(id, tableName, dynamoClient);

  // Validate package size
  if (typeof metadata.size !== "number" || metadata.size <= 0) {
    throw new Error(`Package "${id}" has an invalid or missing size.`);
  }
  const standaloneCost = metadata.size;

  // Check for dependencies
  const dependencies = metadata.dependencies || [];
  if (!Array.isArray(dependencies)) {
    throw new Error(`Dependencies for package "${id}" are invalid.`);
  }

  if (dependencies.length === 0) {
    return standaloneCost;
  }

  // the cost for all dependencies 
  const dependenciesCost = await Promise.all(
    dependencies.map(async (dep: { id: string }) => {
      if (!dep.id) {
        throw new Error(`Dependency in package "${id}" has a missing ID.`);
      }
      return calculateCostRecursive(dep.id, tableName, dynamoClient);
    })
  );

  // Sum costs
  return standaloneCost + dependenciesCost.reduce((sum, cost) => sum + cost, 0);
};

export const getPackageCost = async (
  id: string,
  dependency: boolean,
  tableName: string,
  dynamoClient: DynamoDBDocumentClient
): Promise<any> => {
  try {
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify("Package ID is required."),
      };
    }

    // Calculate costs
    const standaloneCost = await calculateCostRecursive(id, tableName, dynamoClient);
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
