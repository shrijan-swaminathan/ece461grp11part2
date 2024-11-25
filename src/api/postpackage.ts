import { APIGatewayProxyResult } from 'aws-lambda';
import { PutObjectCommand} from "@aws-sdk/client-s3";
import { randomUUID } from 'crypto';
import { PackageData, PackageMetadata, Package } from './types';
import { GetCommand, PutCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
// import { findReadme } from './readme';


export async function postpackage(
  tableName: string, 
  bodycontent: any, 
  curr_bucket: string, 
  s3Client: any, 
  dynamoClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  try {
    let packageData: PackageData = JSON.parse(bodycontent);
    const { Name: packageName, Content: packageContent, URL: packageURL, debloat, JSProgram } = packageData;
    const bucketName = curr_bucket;

    if (!packageName) {
        throw new Error("Package name is required");
    }

    if (packageURL && packageContent) {
        throw new Error("Cannot provide both URL and Content");
    }

    if (!packageURL && !packageContent) {
        throw new Error("Must provide either URL or Content");
    }

    let zipContent: Buffer = Buffer.from('');
    if (packageURL) {
        // TODO: Implement URL download logic
    } else {
        zipContent = Buffer.from(packageContent || '', 'base64');
    }
    
    // Extract README from zip content
    let readme = '';
    // const readme = await findReadme(zipContent);
    
    const version = "1.0.0";
    const packageID = randomUUID() as string;
    
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: '#name = :name AND #version = :version',
      ExpressionAttributeNames: {
          '#name': 'Name',
          '#version': 'Version'
      },
      ExpressionAttributeValues: {
          ':name': packageName,
          ':version': version
      }
    });

    const existingPackage = await dynamoClient.send(command);
    
    if (existingPackage.Items && existingPackage.Items.length > 0) {
        return {
            statusCode: 409,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify("Package already exists")
        }
    }
    
    // Store in S3
    const s3key = `packages/${packageName}/${packageID}/package.zip`;
    await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: s3key,
        Body: zipContent,
        ContentType: 'application/zip'
    }));
    
    // Store metadata
    const metadata: PackageMetadata = {
        Name: packageName,
        Version: version,
        ID: packageID
    };
    
    // Store in DynamoDB
    // When fully implemented, this should include reame, URL, and ratings
    const command2 = new PutCommand({
      TableName: tableName,
      Item: {
        ID: packageID,
        Name: packageName,
        Version: version,
        Readme: readme || '',
        URL: packageURL || '',
        Timestamp: new Date().toISOString()
      }
    });

    // Send the command to DynamoDB
    await dynamoClient.send(command2);
    
    const Packageresponse: Package = {
        metadata: metadata,
        data: packageData
    };
    
    return {
        statusCode: 201,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify(Packageresponse)
    };
} catch (error: any) {
    return {
        statusCode: 400,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify(error.message)
    };
  }
}