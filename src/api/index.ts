import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client,PutObjectCommand, ListObjectsV2Command, GetObjectCommand} from "@aws-sdk/client-s3";
import { randomUUID } from 'crypto';
import { Track, TrackSelection, PackageData, PackageMetadata, Package, PackageCost } from './types';
import { gettracks } from './gettracks';

const s3Client = new S3Client({ region: "us-east-2" });
let curr_bucket = 'ece461gp11-root-bucket';
  
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod || 'GET';
  const headers = event.headers || {};
  const pathParameters = event.pathParameters || {};
  const queryStringParameters = event.queryStringParameters || {};
  const resourcePath = event.resource || '';
  const bodycontent = event.body || '';
  
  // Check to see if it's a GET request for team's selected tracks
  if (httpMethod === "GET" && resourcePath === "/tracks") {
    return gettracks();
  }

  // POST /packages
  if (httpMethod === 'POST' && resourcePath === '/packages') {
    try {
      const packages: PackageData[] = JSON.parse(bodycontent);
      const uploadedPackages: PackageMetadata[] = [];

      for (const packageData of packages) {
        const { Name, Content, URL, debloat } = packageData;

        if (!Name || (!Content && !URL)) {
          return {
            statusCode: 400,
            body: JSON.stringify("Package data is invalid. Name and either Content or URL are required.")
          };
        }

        const version = "1.0.0"; // You can implement versioning logic here.
        const s3Key = `${Name}/${version}/${Name}.zip`;

        // Check if the package already exists
        const exists = await s3Client.send(new ListObjectsV2Command({
          Bucket: curr_bucket,
          Prefix: `${Name}/`,
          MaxKeys: 1
        })).then(response => response.Contents && response.Contents.length > 0).catch(() => false);

        if (exists) {
          return {
            statusCode: 409,
            body: JSON.stringify(`Package "${Name}" already exists.`)
          };
        }

        const contentBuffer = Buffer.from(Content || '', 'base64');
        await s3Client.send(new PutObjectCommand({
          Bucket: curr_bucket,
          Key: s3Key,
          Body: contentBuffer,
          ContentType: 'application/zip'
        }));

        const metadata: PackageMetadata = {
          Name,
          Version: version,
          ID: `${Name}-${version}`
        };

        const metadataKey = `${Name}/${version}/metadata.json`;
        await s3Client.send(new PutObjectCommand({
          Bucket: curr_bucket,
          Key: metadataKey,
          Body: JSON.stringify(metadata),
          ContentType: 'application/json'
        }));

        uploadedPackages.push(metadata);
      }

      return {
        statusCode: 200,
        body: JSON.stringify(uploadedPackages)
      };
    } catch (error: any) {
      return {
        statusCode: 500,
        body: JSON.stringify(`Error uploading packages: ${error.message}`)
      };
    }
  }

  // GET /package/{id}/cost
  if (httpMethod === 'GET' && resourcePath === '/package/{id}/cost') {
    try {
      const id = pathParameters.id;
      const dependency = queryStringParameters.dependency === 'true';

      if (!id) {
        return {
          statusCode: 400,
          body: JSON.stringify("Package ID is required.")
        };
      }


      const metadataKey = `${id.split('-')[0]}/1.0.0/metadata.json`;
      const metadataObject = await s3Client.send(new GetObjectCommand({
        Bucket: curr_bucket,
        Key: metadataKey
      })).catch(() => {
        throw new Error(`Package ID "${id}" not found.`);
      });

      // Simulated cost calculation
      const standaloneCost = 25.0; 
      const transitiveDependenciesCost = 50.0; 
      const totalCost = dependency ? standaloneCost + transitiveDependenciesCost : standaloneCost;

      const costResponse: PackageCost = {
        standaloneCost,
        totalCost
      };

      return {
        statusCode: 200,
        body: JSON.stringify({ [id]: costResponse })
      };
    } catch (error: any) {
      return {
        statusCode: 404,
        body: JSON.stringify(error!.message)
      };
    }
  }
  
  // handle to handle this request:
  // POST /package
  if (httpMethod === "POST" && resourcePath === "/package") {
    try {
      let packageData: PackageData = JSON.parse(bodycontent);
      const { Name: packageName, Content: packageContent, URL: packageURL, debloat, JSProgram } = packageData;
      const bucketName = curr_bucket;
  
      if (!packageName && packageContent) {
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
      const s3key = `packages/${packageName}/${packageID}/package.zip`;
      const s3key2 = `${packageName}/${packageID}`;

      // check if key already exists
      const exists = await s3Client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: s3key2,
        MaxKeys: 1
      })).then(response => response.Contents!.length > 0)
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
  }

  // download from URL
  async function downloadFromUrl(url: string){
    // if url is github
    // got to npm registry, fetch github link, fetch zip file
    // TODO: Implement logic to download package from URL
  }

  // Handle other cases if needed
  return {
    statusCode: 404,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
    },
    body: JSON.stringify("Not Found")
  };

};
