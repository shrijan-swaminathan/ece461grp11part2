import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client,PutObjectCommand, ListObjectsV2Command, GetObjectCommand} from "@aws-sdk/client-s3";
import { SSMClient } from "@aws-sdk/client-ssm";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { PackageData, PackageMetadata, PackageCost } from './types.js';
import { gettracks } from './gettracks.js';
import { postpackage } from './postpackage.js';
import { deleteAllObjects } from './deletereset.js';
import { getPackage } from './getpackage.js';
import { updatepackage } from './updatepackage.js';
import { postpackages } from './postpackages.js';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";
import { postPackageByRegEx } from './postPackageByRegEx.js';
import { getPackageCost } from './getPackageCost.js';
import { getpackagerating } from './getpackagerating.js';

const s3Client = new S3Client({ region: "us-east-2" });
const client = new DynamoDBClient({ region: "us-east-2" });
const dynamoClient = DynamoDBDocumentClient.from(client);
const ssmClient = new SSMClient({ region: "us-east-2" });
const lambdaClient = new LambdaClient({ region: 'us-east-2' });

let curr_bucket = 'ece461gp11-root-bucket';
let tableName = 'PackageMetaData';
  
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod || 'GET';
  const headers = event.headers || {};
  const pathParameters = event.pathParameters || {};
  const queryStringParameters = event.queryStringParameters || {};
  const resourcePath = event.resource || '';
  const bodycontent = event.body || '';

  
  // Check to see if it's a GET request for team's selected tracks
  if (httpMethod === "GET" && resourcePath === "/tracks") {
    console.log("GET /tracks invoked!");
    return gettracks();
  }

  // POST /packages - needs to be fixed, insetad of pushing multiple packages
  // it should be able to fetch multiple packages given a Name/semver
  if (httpMethod === 'POST' && resourcePath === '/packages') {
    console.log("POST /packages invoked!")
    console.log("Body: ", JSON.parse(bodycontent));
    console.log("Query: ", queryStringParameters);
    const resp = await postpackages(tableName, queryStringParameters, bodycontent, dynamoClient);
    return resp;
  }
  
  // handle to handle this request:
  // POST /package
  if (httpMethod === "POST" && resourcePath === "/package") {
    console.log("POST /package invoked!");
    console.log("Body: ", JSON.parse(bodycontent));
    const resp = await postpackage(tableName, bodycontent, curr_bucket, s3Client, dynamoClient, ssmClient, lambdaClient);
    return resp;
  }

  if (httpMethod === "DELETE" && resourcePath === "/reset") {
    console.log("DELETE /reset invoked!");
    const resp  = await deleteAllObjects(tableName, curr_bucket, s3Client, dynamoClient);
    return resp;
  }

  if (httpMethod === "GET" && resourcePath === "/package/{id}") {
    console.log("GET /package/{id} invoked!");
    console.log("ID: ", pathParameters.id);
    const resp = await getPackage(tableName, pathParameters.id, curr_bucket, s3Client, dynamoClient);
    return resp;
  }

  if (httpMethod == "POST" && resourcePath === "/package/{id}") {
    console.log("POST /package/{id} invoked!");
    console.log("ID: ", pathParameters.id);
    console.log("Body: ", JSON.parse(bodycontent));
    const resp = await updatepackage(tableName, pathParameters.id||'', bodycontent, curr_bucket, s3Client, dynamoClient, ssmClient, lambdaClient);
    return resp;
  }

  if (httpMethod === 'GET' && resourcePath === '/package/{id}/cost') {
    const id = pathParameters.id || '';
    const dependency = queryStringParameters?.dependency === 'true';
  
    const response = await getPackageCost(id, dependency, tableName, dynamoClient);
    return response;
  }
  

  if (httpMethod === "POST" && resourcePath === "/package/byRegEx") {
    const resp = await postPackageByRegEx(dynamoClient, tableName, bodycontent);
    return resp;
  }

  if (httpMethod === "GET" && resourcePath === "/package/{id}/rate") {
    console.log("GET /package/{id}/rate invoked!");
    console.log("ID: ", pathParameters.id);
    const id = pathParameters.id || '';
    const resp = await getpackagerating(tableName, id, dynamoClient);
    return resp;
  }
  
  // Handle other cases if needed
  return {
    statusCode: 404,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: JSON.stringify("Not a valid endpoint.")
  };

};
