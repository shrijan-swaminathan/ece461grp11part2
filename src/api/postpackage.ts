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
import AdmZip from 'adm-zip';
// import { findReadme } from './readme';

/* This function invokes the target Lambda function to get the ratings for the package */
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

/**
 * Handles the posting of a package to the system. This function validates the package data,
 * fetches the package content from the provided URL or content, evaluates the package metrics,
 * and stores the package in S3 and DynamoDB.
 *
 * @param tableName - The name of the DynamoDB table to store package metadata.
 * @param bodycontent - The body content of the package, which includes the package name, content, URL, etc.
 * @param curr_bucket - The name of the S3 bucket to store the package content.
 * @param s3Client - The S3 client used to interact with the S3 bucket.
 * @param dynamoClient - The DynamoDB client used to interact with the DynamoDB table.
 * @param ssmClient - The SSM client used to fetch parameters from AWS Systems Manager Parameter Store.
 * @param lambdaClient - The Lambda client used to invoke other Lambda functions.
 * @returns An APIGatewayProxyResult containing the status code, headers, and body of the response.
 * @throws Will throw an error if the package data is invalid or if there are issues with fetching or storing the package.
 */

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
            // Implement URL download logic

            // First, take URL, plug into metrics evaluation, and check to see if all metrics > 0.5
            // const metrics = await evaluateMetrics(packageURL);
            ratings = await invokeTargetLambda(packageURL, lambdaClient);
            
            const { 
                    BusFactor: busfactor,
                    BusFactorLatency: busfactor_latency,
                    Correctness: correctness,
                    CorrectnessLatency: correctness_latency,
                    RampUp: rampup,
                    RampUpLatency: rampup_latency,
                    ResponsiveMaintainer: responsiveMaintainer,
                    ResponsiveMaintainerLatency: responsiveMaintainer_latency,
                    LicenseScore: license,
                    LicenseScoreLatency: license_latency,
                    GoodPinningPractice: dependencyPinning,
                    GoodPinningPracticeLatency: dependencyPinning_latency,
                    PullRequest: reviewedCode,
                    PullRequestLatency: reviewedCode_latency,
                    NetScore: netscore,
                    NetScoreLatency: netscore_latency
            } = ratings;   
            if (netscore < 0.5) {
                return {
                    statusCode: 424,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
                    },
                    body: JSON.stringify("Package is not uploaded due to the disqualified rating.")
                };
            }
            // Download zip file from URL
            if (packageURL.includes('npmjs.com')) {
                // Remove trailing slash
                packageURL = packageURL.replace(/\/$/, '');
                
                // Update regex to handle full NPM URLs
                const match = packageURL.match(/^([https?:\/\/]*(?:www\.)?npmjs\.com\/package\/([\w-]+)(?:\/v\/(\d+\.\d+\.\d+))?)$/);
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
            }
        } 
        else {
            // extract package.json from zipContent
            zipContent = Buffer.from(packageContent || '', 'base64');
            const zip = new AdmZip(zipContent);
            const entries = zip.getEntries();
            const packageJsonEntry = entries.find(entry =>  entry.entryName.endsWith('package.json') && !entry.entryName.includes('node_modules'));
            console.log("Zip: ", zip);
            console.log("Package json entry:", packageJsonEntry);
            if (!packageJsonEntry) {
                console.log("package.json NOT FOUND");
                throw new Error('package.json not found in the ZIP file.');
            }
            const packageJsonData = JSON.parse(packageJsonEntry.getData().toString('utf-8'));
            let contentURL = null;
            if (packageJsonData.repository && packageJsonData.repository.url) {
                let contentURL = packageJsonData.repository.url;
            }
            console.log(contentURL);
            const pkgName = packageJsonData.name;
            const pkgVersion = packageJsonData.version || 'latest';
            if(!contentURL){
                console.log('repository url is empty');
                // go to npm url after finding name
                if (!pkgName)
                {
                    //since contentUrl is also null
                    console.log('Name is invalid');
                }
                else
                {
                    console.log(`Npm name is ${pkgName} and ${pkgVersion}`);
                    //check if npm url is valid
                    const resp = await fetch(`https://registry.npmjs.org/${pkgName}/${pkgVersion}`);
                    if (!resp.ok) {
                        console.log(`package NOT found on npm: ${resp}`);
                    }
                    else
                    {
                        console.log("content is valid");
                        contentURL = `https://npmjs.com/package/${pkgName}/v/${pkgVersion}`
                    }
                }
            }
            version = '1.0.0';
            if (contentURL){
                ratings = await invokeTargetLambda(contentURL, lambdaClient);
            }
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
                    'Access-Control-Allow-Headers': '*',
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
            Name: packageName || formattedName,
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
            OriginalName: packageName || formattedName,
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
                'Access-Control-Allow-Headers': '*',
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
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify(error.message)
        };
    }
    
}