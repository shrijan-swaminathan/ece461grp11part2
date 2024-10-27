import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// interface APIGatewayEvent {
//     httpMethod?: string;
//     pathParameters?: Record<string, string>;
//     queryStringParameters?: Record<string, string>;
//     resource?: string;
//     body?: string;
// }

type Track = 'Performance track' | 'Access control track' | 'High assurance track' | 'ML inside track';

interface TrackSelection {
    plannedTracks: Track[];
}
  
interface Context {
  // Define any properties of the context you need, e.g., functionName
}
  
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
  