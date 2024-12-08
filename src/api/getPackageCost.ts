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

const visitedPackages = new Set<string>();
const validateDependencies = (dependencies: any, id: string) => {
  if (!Array.isArray(dependencies)) {
    throw new Error(`Dependencies for package "${id}" are invalid.`);
  }
  dependencies.forEach((dep) => {
    if (!dep.id || typeof dep.id !== "string") {
      throw new Error(`Dependency in package "${id}" has a missing or invalid ID.`);
    }
  });
};


const calculateCostRecursive = async (
  id: string,
  tableName: string,
  dynamoClient: DynamoDBDocumentClient
): Promise<number> => {
  if (visitedPackages.has(id)) {
    throw new Error(`Circular dependency detected for package "${id}".`);
  }
  visitedPackages.add(id);

  const metadata = await fetchMetadataFromDynamoDB(id, tableName, dynamoClient);

  const standaloneCost = metadata.size || 0; 
  const dependencies = metadata.dependencies || [];
  validateDependencies(dependencies, id);

  const dependenciesCost = await Promise.all(
    dependencies.map(async (dep: { id: string }) => calculateCostRecursive(dep.id, tableName, dynamoClient))
  );

  return standaloneCost + dependenciesCost.reduce((sum, cost) => sum + cost, 0);
};


const getPackageCost = async (
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

    // Calculate standalone cost
    const standaloneCost = await calculateCostRecursive(id, tableName, dynamoClient);

    // Calculate total cost based on dependency flag
    const totalCost = dependency
      ? await calculateCostRecursive(id, tableName, dynamoClient) 
      : standaloneCost; 

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

