import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import axios from "axios";
import { PackageMetadata, PackageItem } from "./types.js";

export const postPackageByRegEx = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  bodyContent: string,
): Promise<APIGatewayProxyResult> => {
  try{
    if (!bodyContent) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({ message: "Missing request body" }),
      };
    }
    const body = JSON.parse(bodyContent);
    const { regex } = body;
    if (!regex) {
      throw new Error("Missing regex in request body");
    }
    const scanCommand = new ScanCommand({
      TableName: tableName,
    });
    const resp = await dynamoClient.send(scanCommand);
    // go through all the items in the table, check Item.OriginalName against regex and add to the list
    const items = [];
    if (!resp.Items){
      throw new Error("No items found in the table");
    }
    for (const item of resp.Items) {
      if (item.OriginalName.match(regex)) {
        // only want to push {id, name, version} to the items array
        const { ID: id, OriginalName: name, Version: version } = item;
        items.push({ ID: id, Name: name, Version: version });
      }
    }

    if (items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify("No package found under this regex."),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify(items),
    }
  } catch (e: any) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
      body: JSON.stringify(e.message),
    };
  }
}