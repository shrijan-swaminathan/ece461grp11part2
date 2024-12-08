import { APIGatewayProxyResult } from 'aws-lambda';
import { PutObjectCommand} from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { randomUUID } from 'crypto';
import { PackageData, PackageMetadata, Package } from './types.js';
import { PutCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { extractownerrepo } from './helperfunctions/extractownerrepo.js';
import { isValidName } from './helperfunctions/isvalidname.js';
import { Octokit } from '@octokit/core';
// import { findReadme } from './readme';

// add function to invoke lambda function to fetch metrics
async function invokeTargetLambda(url: string, lambdaClient: LambdaClient): Promise<any> {
    const command = new InvokeCommand({
      FunctionName: 'arn:aws:lambda:us-east-2:872515249498:function:metricsFunction',
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify({ URL: url }), 'utf-8')
    });
  
    try {
      const response = await lambdaClient.send(command);
      
      if (response.Payload) {
        const result = JSON.parse(Buffer.from(response.Payload).toString());
        console.log('Target Lambda function output:', result);
        return result.body;
      }
    } catch (error) {
      console.error('Error invoking target Lambda function:', error);
      throw error;
    }
}

export async function postpackage(
  tableName: string, 
  bodycontent: any, 
  curr_bucket: string, 
  s3Client: any, 
  dynamoClient: DynamoDBDocumentClient,
  ssmClient: SSMClient,
  lambdaClient: LambdaClient
): Promise<APIGatewayProxyResult> {
    try {
        if (!bodycontent) {
            throw new Error("Package data is required");
        }
        let packageData: PackageData = JSON.parse(bodycontent);
        let { Name: packageName, Content: packageContent, URL: packageURL, debloat, JSProgram } = packageData;
        const bucketName = curr_bucket;
        let formattedName = "";
        if (packageName){
            if (!isValidName(packageName)) {
                throw new Error("Invalid package name");
            }
            formattedName = packageName.charAt(0).toUpperCase() + packageName.slice(1).toLowerCase();
        }

        if (!packageName && !packageURL) {
            throw new Error("Package name is required");
        }

        if (packageURL && packageContent) {
            throw new Error("Cannot provide both URL and Content");
        }

        if (!packageURL && !packageContent) {
            throw new Error("Must provide either URL or Content");
        }

        let zipContent: Buffer = Buffer.from('');
        let version: string = ""
        let ratings: any = {};

        if (packageURL) {
            // TODO: Implement URL download logic

            // First, take URL, plug into metrics evaluation, and check to see if all metrics > 0.5
            // const metrics = await evaluateMetrics(packageURL);
            // if (metrics.some(metric => metric < 0.5)) {
            //     return {
            //         statusCode: 424,
            //         headers: {
            //             'Access-Control-Allow-Origin': '*',
            //             'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            //         },
            //         body: JSON.stringify("Package is not uploaded due to the disqualified rating.")
            //  };
            // Download zip file from URL
            if (packageURL.includes('npmjs.com')) {
                // Remove trailing slash
                packageURL = packageURL.replace(/\/$/, '');
                
                // Update regex to handle full NPM URLs
                const match = packageURL.match(/^(https?:\/\/(?:www\.)?npmjs\.com\/package\/([\w-]+)(?:\/v\/(\d+\.\d+\.\d+))?)$/);
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
                version = npmversion !== 'latest' ? npmversion : metadata?.version;
                
                // Set formatted name if not provided
                if (!packageName) {
                    formattedName = metadata?.name;
                    formattedName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1).toLowerCase();
                }
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
                packageData['Content'] = Buffer.from(content).toString('base64');
                ratings = await invokeTargetLambda(packageURL, lambdaClient);
                
            }
            else{
                let githubURL: string = packageURL;
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
                packageData['Content'] = zipContent.toString('base64');
                // now fetch version from package.json
                const { data: packageJson } = await octokit.request(
                    'GET /repos/{owner}/{repo}/contents/package.json',
                    {
                        owner: owner,
                        repo: repo,
                        ref: branch
                    }
                );
                const packageJsonContent = Buffer.from(packageJson.content, 'base64').toString('utf-8');
                const packageJsonData = JSON.parse(packageJsonContent);
                version = packageJsonData?.version;
                if (!packageName){
                    formattedName = packageJsonData?.name;
                    if (!formattedName){
                        // use repo name as package name
                        formattedName = repo;
                    }
                    formattedName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1).toLowerCase();
                }
                ratings = await invokeTargetLambda(packageURL, lambdaClient);
            }
        } 
        else {
            zipContent = Buffer.from(packageContent || '', 'base64');
            version = "1.0.0";
        }
        
        // Extract README from zip content
        let readme = '';
        // const readme = await findReadme(zipContent);
        const packageID = randomUUID() as string;
        const command = new ScanCommand({
            TableName: tableName,
            FilterExpression: '#name = :name AND #version = :version',
            ExpressionAttributeNames: {
                '#name': 'Name',
                '#version': 'Version'
            },
            ExpressionAttributeValues: {
                ':name': formattedName,
                ':version': version
            } as Record<string, string>
        });

        const existingPackage = await dynamoClient.send(command);

        if (existingPackage.Items && existingPackage.Items.length > 0) {
            return {
                statusCode: 409,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                },
                body: JSON.stringify("Package already exists")
            }
        }
        
        // Store in S3
        if (!packageURL || packageURL.includes('github.com')) {
            const s3key = `packages/${formattedName}/${packageID}/package.zip`;
            await s3Client.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: s3key,
                Body: zipContent,
                ContentType: 'application/zip'
            }));
        }

        else{
            const s3key = `packages/${formattedName}/${packageID}/package.tgz`;
            await s3Client.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: s3key,
                Body: zipContent,
                ContentType: 'application/tgz'
            }));
        }
        
        // Store metadata
        const metadata: PackageMetadata = {
            Name: formattedName,
            Version: version,
            ID: packageID
        };
        
        // Store in DynamoDB
        // When fully implemented, this should include readme and URL
        const command2 = new PutCommand({
        TableName: tableName,
        Item: {
            ID: packageID,
            Name: formattedName,
            Version: version,
            Readme: readme || '',
            URL: packageURL || '',
            Timestamp: new Date().toISOString(),
            Ratings: ratings || {},
        }
        });

        // Send the command to DynamoDB
        await dynamoClient.send(command2);
        
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
    } 
    catch (error: any) {
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