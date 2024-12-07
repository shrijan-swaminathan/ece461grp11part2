import * as semver from "semver";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from 'crypto';
import { PutObjectCommand} from "@aws-sdk/client-s3";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { Octokit } from "@octokit/core";
import { extractownerrepo } from "./helperfunctions/extractownerrepo.js";

/**
 * POST /package/{id} - Updates a package by creating a new version with either new content or URL
 * @param tableName - The name of the DynamoDB table
 * @param ID - The ID of the existing package to update
 * @param bodycontent - JSON containing metadata and package data
 * @param curr_bucket - The name of the S3 bucket
 * @param s3Client - The S3 client
 * @param dynamoClient - The DynamoDB client
 * @param ssmClient - The SSM client for accessing GitHub token
 * @returns APIGatewayProxyResult with success/error message
 * @throws Error if invalid version, mismatched IDs, invalid content/URL combination
 */

export async function updatepackage(
    tableName: string, 
    ID: string, 
    bodycontent: any, 
    curr_bucket: string, 
    s3Client: any, 
    dynamoClient: DynamoDBDocumentClient,
    ssmClient: SSMClient): Promise<APIGatewayProxyResult>
{
    try{
        if (!bodycontent) {
            throw new Error("Package data is required");
        }
        if (!ID) {
            throw new Error("ID is required");
        }
        const command = new GetCommand({
            TableName: tableName,
            Key: {
                'ID': ID
            }
        });

        const packagemetaData = await dynamoClient.send(command);
        const packageName = packagemetaData.Item?.Name;
        const packageURL = packagemetaData.Item?.URL;

        if (!packageName) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("Package does not exist.")
            }
        }

        const command2 = new ScanCommand({
            TableName: tableName,
            FilterExpression: '#name = :name',
            ExpressionAttributeNames: {
                '#name': 'Name'
            },
            ExpressionAttributeValues: {
                ':name': packageName
            }
        });
        const existingPackages = await dynamoClient.send(command2);

        // put all versions of existing packages into an array
        let existingVersions = [];
        for (const item of existingPackages.Items!){
            existingVersions.push(item.Version);
        }


        const {metadata, data} = JSON.parse(bodycontent);
        const {Name: Name, Version: newVersion, ID: metaID} = metadata;
        let {Name: PackageName, Content: newContent, URL: newURL, debloat: newdebloat, JSProgram: JSProgram} = data;
        let formattedName = "";
        if (PackageName){
            formattedName = PackageName.charAt(0).toUpperCase() + PackageName.slice(1).toLowerCase();
        }
        else if (Name){
            formattedName = Name.charAt(0).toUpperCase() + Name.slice(1).toLowerCase();
        }
        else if (packageName){
            formattedName = packageName.charAt(0).toUpperCase() + packageName.slice(1).toLowerCase();
        }
        else{
            throw new Error("Package name is required");
        }
        if (!newVersion || !metaID){
            throw new Error("Version and ID are required");
        }
        if (metaID !== ID){
            throw new Error("ID does not match");
        }
        if (newContent && newURL || newContent && packageURL || newURL && !packageURL){
            throw new Error("Content and URL cannot be both present");
        }
        if (!newContent && !newURL){
            throw new Error("Content or URL must be present");
        }
        if (!semver.valid(newVersion)){
            throw new Error("Invalid version. Must be in semver format");
        }
        if (formattedName != packageName){
            throw new Error("Package name does not match");
        }

        // check if the new version already exists
        if (existingVersions.includes(newVersion)){
            throw new Error("Invalid version. Version already exists");
        }

        // Find highest patch version for same major.minor
        const v1 = semver.parse(newVersion);  // New version being uploaded

        // Get all versions with same major.minor
        const sameMinorVersions = existingVersions.filter(ver => {
            const v2 = semver.parse(ver);
            return v1?.major === v2?.major && v1?.minor === v2?.minor;
        });

        if (sameMinorVersions.length > 0) {
            // Find highest patch version
            const highestPatch = Math.max(...sameMinorVersions.map(v => semver.parse(v)!.patch));
            
            // New patch version must be exactly one more than highest
            if (v1!.patch !== highestPatch + 1) {
                throw new Error("Invalid version.");
            }
        }

        // Upload the new package
        let zipContent: Buffer = Buffer.from('');
        if (newURL) {
            if (newURL.includes('npmjs.com')) {
                // Remove trailing slash
                newURL = newURL.replace(/\/$/, '');
                
                // Update regex to handle full NPM URLs
                const match = newURL.match(/^(https?:\/\/(?:www\.)?npmjs\.com\/package\/([\w-]+)(?:\/v\/(\d+\.\d+\.\d+))?)$/);
                if (!match) {
                    throw new Error("Invalid NPM URL");
                }
            
                const pkgName = match[2];
                const npmversion = match[3] || 'latest';
                
                console.log(`Fetching package ${pkgName} version ${npmversion}`);
                // Fetch package metadata from registry
                const resp = await fetch(`https://registry.npmjs.org/${pkgName}/${npmversion}`);
                if (!resp.ok) {
                    throw new Error("Package not found in NPM registry");
                }
                
                const metadata = await resp.json();
                
                // Get tarball URL and download
                const tarball = metadata?.dist?.tarball;

                console.log("Downloading tarball from", tarball);

                if (!tarball) {
                    throw new Error("Package tarball not found");
                }
                const tarballResp = await fetch(tarball);
                if (!tarballResp.ok) {
                    throw new Error("Failed to download package");
                }
                
                const content = await tarballResp.arrayBuffer();
                zipContent = Buffer.from(content);
            }
            else{
                let githubURL: string = newURL;
                if (githubURL && githubURL.startsWith("git+https://")) {
                    githubURL = githubURL.replace(/^git\+/, "").replace(/\.git$/, "");
                }
                const parameterName = "github-token";
                const command = new GetParameterCommand({
                    Name: parameterName,
                    WithDecryption: true,
                });
                const response = await ssmClient.send(command);
                const githubToken = response.Parameter?.Value || '';
                const octokit = new Octokit({ auth: githubToken });
                let { owner, repo, branch } = extractownerrepo(githubURL);
                if (!branch){
                    const {data: defaultBranch} = await octokit.request(
                        'GET /repos/{owner}/{repo}',
                        {
                            owner: owner,
                            repo: repo
                        }
                    );
                    branch = defaultBranch.default_branch;
                }
                const {data: zipballdata} = await octokit.request(
                    'GET /repos/{owner}/{repo}/zipball/{ref}',
                    {
                        owner: owner,
                        repo: repo,
                        ref: branch
                    }
                ) as {data: ArrayBuffer};
                zipContent = Buffer.from(zipballdata);
            }
        } else {
            zipContent = Buffer.from(newContent || '', 'base64');
        }
        // Extract README from zip content
        let readme = '';

        const newID = randomUUID() as string;

        const s3key = `packages/${formattedName}/${newID}/package.zip`;
        await s3Client.send(new PutObjectCommand({
            Bucket: curr_bucket,
            Key: s3key,
            Body: zipContent,
            ContentType: 'application/zip'
        }));

        const command3 = new PutCommand({
            TableName: tableName,
            Item: {
              ID: newID,
              Name: formattedName,
              Version: newVersion,
              Readme: readme || '',
              URL: newURL || '',
              Timestamp: new Date().toISOString()
            }
        });

        await dynamoClient.send(command3);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify("Version is updated")
        }

        
    }
    catch (error: any) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(error.message)
        }
    }
}