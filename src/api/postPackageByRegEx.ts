import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import axios from "axios";
import { PackageMetadata, PackageItem } from "./types.js";

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
    const { RegEx } = parsedBody;

    if (!RegEx) {
      return {
        statusCode: 400,
        body: JSON.stringify("RegEx field is missing or invalid."),
      };
    }

    const regexPattern = new RegExp(RegEx, "i");
    const normalizeString = (str: string) => str.trim().toLowerCase();

    const scanCommand = new ScanCommand({ TableName: tableName });
    const scanResult = await dynamoClient.send(scanCommand);

    const filteredPackages: (PackageItem | null)[] = await Promise.all(
      (scanResult.Items as PackageItem[]).map(async (item) => {

        let readme = item.README || "";
        if (!readme && item.URL) {
          try {
            const response = await axios.get(item.URL);
            readme = response.data;

            const updateCommand = new PutCommand({
              TableName: tableName,
              Item: { ...item, README: readme },
            });
            await dynamoClient.send(updateCommand);
          } catch (error) {
            console.error(`Failed to fetch README for URL: ${item.URL}`, error);
          }
        }
        const name = normalizeString(item.Name || "");
        const normalizedReadme = normalizeString(readme || "");
        const nameMatch = regexPattern.test(name);
        const readmeMatch = regexPattern.test(normalizedReadme);

        console.log("Testing Name:", name, "against RegEx:", RegEx, "=>", nameMatch);
        console.log("Testing README:", normalizedReadme, "against RegEx:", RegEx, "=>", readmeMatch);

        return nameMatch || readmeMatch ? item : null;
      })
    );
    const validPackages = filteredPackages.filter((pkg): pkg is PackageItem => pkg !== null);

    if (validPackages.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify("No package found under this regex."),
      };
    }

    const response: PackageMetadata[] = validPackages.map((pkg) => ({
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
