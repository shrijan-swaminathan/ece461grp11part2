import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import axios from "axios";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { PackageMetadata, PackageItem } from "./types.js";
import * as unzipper from "unzipper";

export const postPackageByRegEx = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  bodyContent: string,
  s3Client: S3Client,
  bucketName: string
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
            // Fetch README from GitHub
            if (item.URL.includes("github.com")) {
              const githubReadmeURL = convertToRawGitHubURL(item.URL);
              const response = await axios.get(githubReadmeURL);
              readme = response.data;
            }
            // Fetch README from NPM
            else if (item.URL.includes("npmjs.com")) {
              const npmReadmeURL = `${item.URL}/README.md`;
              const response = await axios.get(npmReadmeURL);
              readme = response.data;
            }
          } catch (error) {
            console.error(`Failed to fetch README for URL: ${item.URL}`, error);
          }
        }

        // Fetch README from zipped package content in S3
        if (!readme) {
          try {
            const s3Params = {
              Bucket: bucketName,
              Key: `packages/${item.Name}/${item.ID}/package.zip`,
            };
            const s3Object = await s3Client.send(new GetObjectCommand(s3Params));
            const stream = s3Object.Body.pipe(unzipper.Parse({ forceStream: true }));
            for await (const entry of stream) {
              const fileName = entry.path;
              if (fileName.toLowerCase() === "readme.md") {
                readme = await entry.buffer().then((buf: Buffer) => buf.toString());
                break;
              }
              entry.autodrain();
            }
          } catch (error) {
            console.error(`Failed to fetch README from S3 for package: ${item.Name}`, error);
          }
        }

        // Update DynamoDB if README is found
        if (readme) {
          const updateCommand = new PutCommand({
            TableName: tableName,
            Item: { ...item, README: readme },
          });
          await dynamoClient.send(updateCommand);
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

/**
 * Converts a GitHub repository URL to a raw URL for fetching files like README.md
 * @param url - The GitHub repository URL
 * @returns - The raw content URL for the README file
 */
const convertToRawGitHubURL = (url: string): string => {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)(\/|$)/);
  if (!match) {
    throw new Error("Invalid GitHub URL");
  }
  const [_, owner, repo] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;
};
