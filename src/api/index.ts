import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

type Track = 'Performance track' | 'Access control track' | 'High assurance track' | 'ML inside track';

interface TrackSelection {
    plannedTracks: Track[];
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
    console.log("Body content: " + bodycontent);
  
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
      const bodyContent = JSON.parse(bodycontent);
      // The bucket name is depending on X-auth-token
      try{
        // const createBucketCommand = new CreateBucketCommand({
        //     Bucket: 'ece461gp11-root-bucket',
        // });
        // await s3Client.send(createBucketCommand);
      }
      catch(error){
        return{
          statusCode: 400,
          body: JSON.stringify("Failed to create bucket: " + error)
        }
      }
      return{
        statusCode: 200,
        body: JSON.stringify("Uploaded a package: ")
      }
    }


    // Handle other cases if needed
    return {
      statusCode: 404,
      body: JSON.stringify("Not Found")
    };
};
