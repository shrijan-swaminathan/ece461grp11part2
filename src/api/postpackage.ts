import { APIGatewayProxyResult } from 'aws-lambda';
import { PutObjectCommand, ListObjectsV2Command, ListObjectsV2Output} from "@aws-sdk/client-s3";
import { randomUUID } from 'crypto';
import { PackageData, PackageMetadata, Package} from './types';

// download from URL
async function downloadFromUrl(url: string){
    // if url is github
    // got to npm registry, fetch github link, fetch zip file
    // TODO: Implement logic to download package from URL
}

export async function postpackage(bodycontent: any, curr_bucket: string, s3Client: any): Promise<APIGatewayProxyResult> {
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
          // TODO: Implement logic to download package from URL
          // Public NPM package is ingestible if it passes metrics
          // see doc for more details
          // await downloadFromUrl(packageURL);
        } else {
          zipContent = Buffer.from(packageContent || '', 'base64');
        }
        
        if (debloat) {
          // TODO: Implement debloat logic
          // zipContent = await debloatPackage(zipContent);
        }
        const version = "1.0.0"; // TODO: Extract or generate version
        const packageID = randomUUID() as string;
        const s3key2 = `packages/${packageName}/`;
  
        // check if key already exists
        const exists = await s3Client.send(new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: s3key2,
          MaxKeys: 1
        })).then((response: ListObjectsV2Output) => response.Contents!.length > 0)
          .catch(() => false);
  
        if (exists) {
          return {
            statusCode: 409,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify("Package already exists")
          }
        }
        
        const s3key = `packages/${packageName}/${packageID}/package.zip`;
        const uploadCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: s3key,
          Body: zipContent,
          ContentType: 'application/zip'
        });
        await s3Client.send(uploadCommand);
  
        // Store PackageMetadata json file
        const metadata: PackageMetadata = {
          Name: packageName,
          Version: version,
          ID: packageID
        };
        const metadataKey = `packages/${packageName}/${packageID}/metadata.json`;
        const metadataContent = JSON.stringify(metadata);
        const metadataUploadCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: metadataKey,
          Body: metadataContent,
          ContentType: 'application/json'
        });
        await s3Client.send(metadataUploadCommand);
  
        // Need to create/update index/package-index.json
        const indexKey = 'index/package-index.json';
        const indexEntry = {
        packages: {
          [packageName]: {
            versions: [{
              version: version,
              packageId: packageID,
              timestamp: new Date().toISOString()
            }]
          }
        }
        };
  
        // Need to either create new index file or update existing one
        const indexUploadCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: indexKey,
          Body: JSON.stringify(indexEntry),
          ContentType: 'application/json'
        });
        await s3Client.send(indexUploadCommand);
  
        
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
};