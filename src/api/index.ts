import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3 } from "aws-sdk";

type Track = 'Performance track' | 'Access control track' | 'High assurance track' | 'ML inside track';

interface TrackSelection {
    plannedTracks: Track[];
}

const s3 = new S3({ region: "us-east-2" });
  
  export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const httpMethod = event.httpMethod || 'GET';
      const pathParameters = event.pathParameters || {};
      const queryStringParameters = event.queryStringParameters || {};
      const resourcePath = event.resource || '';
      const body = event.body;
    
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
        try{
          await s3.createBucket({ Bucket: 'testbucket'}).promise();
        }
        catch(error){
          return{
            statusCode: 400,
            body: JSON.stringify("Failed to create bucket")
          }
        }
        return{
          statusCode: 200,
          body: JSON.stringify("Uploaded a package")
        }
      }

  
      // Handle other cases if needed
      return {
        statusCode: 404,
        body: JSON.stringify("Not Found")
      };
  };
  