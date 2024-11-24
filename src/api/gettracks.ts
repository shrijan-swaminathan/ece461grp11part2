import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Track, TrackSelection, PackageData, PackageMetadata, Package, PackageCost } from './types';

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
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify(response)
        };
    } catch (error) {
        return {
        statusCode: 500,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify("The system encountered an error while retrieving the student's track information.")
        };
    }
};