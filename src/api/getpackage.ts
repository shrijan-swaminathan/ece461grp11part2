import { APIGatewayProxyResult } from 'aws-lambda';
import { GetObjectCommand} from "@aws-sdk/client-s3";
import { PackageIndex } from './types';

export async function getPackage(ID: any, curr_bucket: string, s3Client: any ): Promise<APIGatewayProxyResult> {
    try{
        // First look through index/package-index.json to find packageName associated with ID
        const indexParams = {
            Bucket: curr_bucket,
            Key: 'index/package-index.json'
        };
        const idxData = await s3Client.send(new GetObjectCommand(indexParams));
        const indexContent = JSON.parse(await idxData.Body.transformToString());
        let packageName = '';
        let packageURL = '';
        Object.entries(indexContent.packages as PackageIndex['packages']).forEach(([name, data]) => {
            const versionInfo = data.versions.find(v => v.packageId === ID);
            if (versionInfo) {
                packageName = name;
                packageURL = versionInfo.URL || '';  // Get URL if it exists
            }
        });
        if (!packageName) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("Package does not exist")
            }
        }
        // get the package metadata.json and package.zip
        const packageParams = {
            Bucket: curr_bucket,
            Key: `packages/${packageName}/${ID}/package.zip`
        };

        const packageData = await s3Client.send(new GetObjectCommand(packageParams));
        const content = await packageData.Body.transformToString('base64');

        // Get metadata
        const metadataParams = {
            Bucket: curr_bucket,
            Key: `packages/${packageName}/${ID}/metadata.json`
        };

        const metadataData = await s3Client.send(new GetObjectCommand(metadataParams));
        const metadata = JSON.parse(await metadataData.Body.transformToString());

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                metadata: metadata,
                data: {
                    Content: content,
                    ...(packageURL && { URL: packageURL })
                }
            })
        };
    }
    catch (error: any) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(error!.message)
        };
    }
}