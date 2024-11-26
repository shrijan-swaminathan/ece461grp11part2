import * as semver from "semver";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from 'crypto';
import { PutObjectCommand} from "@aws-sdk/client-s3";

export async function updatepackage(
    tableName: string, 
    ID: any, 
    bodycontent: any, 
    curr_bucket: string, 
    s3Client: any, 
    dynamoClient: DynamoDBDocumentClient): Promise<APIGatewayProxyResult>
{
    try{
        const command = new GetCommand({
            TableName: tableName,
            Key: {
                'ID': ID
            }
        });

        const packagemetaData = await dynamoClient.send(command);
        const packageName = packagemetaData.Item?.Name;
        const packageURL = packagemetaData.Item?.URL;

        if (!packageName) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("Package does not exist.")
            }
        }

        const command2 = new ScanCommand({
            TableName: tableName,
            FilterExpression: '#name = :name',
            ExpressionAttributeNames: {
                '#name': 'Name'
            },
            ExpressionAttributeValues: {
                ':name': packageName
            }
        });
        const existingPackages = await dynamoClient.send(command2);

        // put all versions of existing packages into an array
        let existingVersions = [];
        for (const item of existingPackages.Items!){
            existingVersions.push(item.Version);
        }


        const {inputmetadata, data} = JSON.parse(bodycontent);
        const {Name, newVersion, metaID} = inputmetadata;
        const {PackageName, newContent, newURL, newdebloat, JSProgram} = data;

        const formattedName = PackageName.charAt(0).toUpperCase() + PackageName.slice(1).toLowerCase();
        if (metaID !== ID){
            throw new Error("ID does not match");
        }
        if (newContent && newURL || newContent && packageURL || newURL && !packageURL){
            throw new Error("Content and URL cannot be both present");
        }
        if (!newContent && !newURL){
            throw new Error("Content or URL must be present");
        }
        if (!semver.valid(newVersion)){
            throw new Error("Invalid version. Must be in semver format");
        }
        if (formattedName != packageName){
            throw new Error("Package name does not match");
        }

        // check if the new version already exists
        if (existingVersions.includes(newVersion)){
            throw new Error("Invalid version. Version already exists");
        }

        // Find highest patch version for same major.minor
        const v1 = semver.parse(newVersion);  // New version being uploaded

        // Get all versions with same major.minor
        const sameMinorVersions = existingVersions.filter(ver => {
            const v2 = semver.parse(ver);
            return v1?.major === v2?.major && v1?.minor === v2?.minor;
        });

        if (sameMinorVersions.length > 0) {
            // Find highest patch version
            const highestPatch = Math.max(...sameMinorVersions.map(v => semver.parse(v)!.patch));
            
            // New patch version must be exactly one more than highest
            if (v1!.patch !== highestPatch + 1) {
                throw new Error("Invalid version.");
            }
        }

        // Upload the new package
        let zipContent: Buffer = Buffer.from('');
        if (newURL) {
            // TODO: Implement URL download logic
        } else {
            zipContent = Buffer.from(newContent || '', 'base64');
        }
        // Extract README from zip content
        let readme = '';

        const newID = randomUUID() as string;

        const s3key = `packages/${formattedName}/${newID}/package.zip`;
        await s3Client.send(new PutObjectCommand({
            Bucket: curr_bucket,
            Key: s3key,
            Body: zipContent,
            ContentType: 'application/zip'
        }));

        const command3 = new PutCommand({
            TableName: tableName,
            Item: {
              ID: newID,
              Name: formattedName,
              Version: newVersion,
              Readme: readme || '',
              URL: newURL || '',
              Timestamp: new Date().toISOString()
            }
        });

        await dynamoClient.send(command3);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify("Version is updated")
        }

        
    }
    catch (error) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(error)
        }
    }
}