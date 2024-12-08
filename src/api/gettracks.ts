import { APIGatewayProxyResult } from 'aws-lambda';
import { Track, TrackSelection} from './types.js';

/**
 * GET /tracks - Fetches the tracks available for the student
 * @returns The APIGatewayProxyResult containing the student's track information
 * @throws Error if there's an error fetching the data
 */

export function gettracks(): APIGatewayProxyResult {
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
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(response)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify("The system encountered an error while retrieving the student's track information.")
        };
    }
};
