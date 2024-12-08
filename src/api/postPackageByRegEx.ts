import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { PackageMetadata, PackageItem } from './types.js';

export const postPackageByRegEx = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  bodyContent: string
): Promise<APIGatewayProxyResult> => {
  try {
    // Validate body content
    if (!bodyContent) {
      return {
        statusCode: 400,
        body: JSON.stringify("Request body is required."),
      };
    }

    const parsedBody = JSON.parse(bodyContent);
    const { RegEx } = parsedBody;

    // Validate RegEx field
    if (!RegEx) {
      return {
        statusCode: 400,
        body: JSON.stringify("RegEx field is missing or invalid."),
      };
    }

    const regexPattern = new RegExp(RegEx, "i"); // Create case-insensitive regex pattern

    // Query DynamoDB to fetch all items
    const scanCommand = new ScanCommand({
      TableName: tableName,
    });

    const scanResult = await dynamoClient.send(scanCommand);

    // Filter items based on Name and README fields
    const filteredPackages: PackageItem[] = (scanResult.Items as PackageItem[]).filter((item) => {
      const name = item.Name || ""; // Ensure Name exists
      const readme = item.README || ""; // Ensure README exists
      const nameMatch = regexPattern.test(name); // Match regex in Name
      const readmeMatch = regexPattern.test(readme); // Match regex in README
      return nameMatch || readmeMatch;
    });

    // Handle no matching packages
    if (!filteredPackages || filteredPackages.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify("No package found under this regex."),
      };
    }

    // Map filtered results into response format
    const response: PackageMetadata[] = filteredPackages.map((pkg) => ({
      Version: pkg.Version || "",
      Name: pkg.Name || "",
      ID: pkg.ID || "",
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error("Error processing /package/byRegEx request:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
      body: JSON.stringify("An internal server error occurred."),
    };
  }
};
