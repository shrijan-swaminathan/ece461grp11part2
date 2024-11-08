import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client,PutObjectCommand } from "@aws-sdk/client-s3";

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
          plannedTracks: [tracks[1]]
        };
        return {
          statusCode: 200,
          body: JSON.stringify(response)
        };
      } catch (error) {
        return {
          statusCode: 500,
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
          await downloadFromUrl(packageURL);
          return {
            statusCode: 200,
            body: JSON.stringify("Package downloaded from URL")
          }
        } else {
          zipContent = Buffer.from(packageContent || '', 'base64');
        }
    
        if (debloat) {
          // TODO: Implement debloat logic
          // zipContent = await debloatPackage(zipContent);
        }
    
        const version = "1.0.0"; // TODO: Extract or generate version
        const s3key = `${packageName}/${version}/${packageName}.zip`;
    
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
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    // download from URL
    async function downloadFromUrl(url: string){
      // if url is github
      if (url.includes('github')){
        const [_, owner, repo, ...rest] = url.split('/').filter(Boolean);
        console.log("owner: ", owner);
        console.log("repo: ", repo);
      }
    }

    // Handle other cases if needed
    return {
      statusCode: 404,
      body: JSON.stringify("Not Found")
    };
};
