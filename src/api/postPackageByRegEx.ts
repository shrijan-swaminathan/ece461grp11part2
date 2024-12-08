import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { PackageMetadata, PackageItem } from './types.js';

export const postPackageByRegEx = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  bodyContent: string
): Promise<APIGatewayProxyResult> => {
  try {
    if (!bodyContent) {
      return {
        statusCode: 400,
        body: JSON.stringify("Request body is required."),
      };
    }

    const parsedBody = JSON.parse(bodyContent);
    const { RegEx, MatchType = "partial" } = parsedBody;

    if (!RegEx) {
      return {
        statusCode: 400,
        body: JSON.stringify("RegEx field is missing or invalid."),
      };
    }
    const regexPattern = new RegExp(RegEx, "i");

    const scanCommand = new ScanCommand({ TableName: tableName });
    const scanResult = await dynamoClient.send(scanCommand);

    const normalizeString = (str: string) => str.trim().toLowerCase();

    // Filter items
    const filteredPackages: PackageItem[] = (scanResult.Items as PackageItem[]).filter((item) => {
      const name = normalizeString(item.Name || "");
      const readme = normalizeString(item.README || "");

      let exactMatch = false;
      let partialMatchName = false;
      let partialMatchReadme = false;

      if (MatchType === "exact") {
        exactMatch = name === RegEx;
      } else if (MatchType === "partial") {
        partialMatchName = regexPattern.test(name);
        partialMatchReadme = regexPattern.test(readme);
      }

      //debug
      console.log("Matching item:", item);
      console.log("Exact Match:", exactMatch, "Partial Name Match:", partialMatchName, "Partial README Match:", partialMatchReadme);

      return exactMatch || partialMatchName || partialMatchReadme;
    });

    if (!filteredPackages || filteredPackages.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify("No package found under this regex."),
      };
    }
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
