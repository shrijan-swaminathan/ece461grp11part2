import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client,PutObjectCommand, ListObjectsV2Command} from "@aws-sdk/client-s3";

// Schema as given in OpenAPI specification
type Track = 'Performance track' | 'Access control track' | 'High assurance track' | 'ML inside track';

interface TrackSelection {
    plannedTracks: Track[];
}

interface PackageData {
  Name: string;
  Content?: string;
  URL?: string;
  debloat?: boolean;
  JSProgram?: string; 
}

interface PackageMetadata {
  Name: string;
  Version: string;
  ID: string;
}

interface Package {
  metadata: PackageMetadata;
  data: PackageData;
}

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
      try {
        const tracks: Track[] = [
          "Performance track",
          "Access control track",
          "High assurance track",
          "ML inside track"
        ];
        const response: TrackSelection = {
          plannedTracks: [tracks[2]]
        };
        return {
          statusCode: 200,
          body: JSON.stringify(response)
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*', 'Acess-Control-Allow-Methods': 'GET, POST, PUT, DELETE' },
          body: JSON.stringify("The system encountered an error while retrieving the student's track information.")
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
        const s3key = `${packageName}/${version}/${packageName}.zip`;
        const s3key2 = `${packageName}/`;
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
          ID: `${packageName}-${version}`
        };
        const metadataKey = `${packageName}/${version}/metadata.json`;
        const metadataContent = JSON.stringify(metadata);
        const metadataUploadCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: metadataKey,
          Body: metadataContent,
          ContentType: 'application/json'
        });
        await s3Client.send(metadataUploadCommand);
    
        if (JSProgram) {
          // TODO: Store or execute JSProgram if needed
          // await storeJSProgram(bucketName, packageName, version, JSProgram);
        }

        const Packageresponse: Package = {
          metadata: metadata,
          data: packageData
        };

        return {
          statusCode: 201,
          body: JSON.stringify(Packageresponse)
        };

      } catch (error: any) {
        return {
          statusCode: 400,
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
      body: JSON.stringify("Not Found")
    };
};
