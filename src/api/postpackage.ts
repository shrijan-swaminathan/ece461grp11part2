import { APIGatewayProxyResult } from 'aws-lambda';
import { PutObjectCommand} from "@aws-sdk/client-s3";
import { randomUUID } from 'crypto';
import { PackageData, PackageMetadata, Package } from './types.js';
import { PutCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { Octokit } from "@octokit/core";
import { extractownerrepo } from './helperfunctions/extractownerrepo.js';
// import { findReadme } from './readme';


export async function postpackage(
  tableName: string, 
  bodycontent: any, 
  curr_bucket: string, 
  s3Client: any, 
  dynamoClient: DynamoDBDocumentClient,
  ssmClient: SSMClient
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
    let version = ""
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
        // if url is GitHub, use the GitHub API to download the zip file
        // if url is NPM, use the NPM API to download the tarball file
        if (packageURL.includes('npmjs.com')) {
            // extract package name from URL
            // cut trailing "/" if exists
            packageURL = packageURL.replace(/\/$/, '');
            const match = packageURL.match(/package\/([\w\-.~]+)(\/([\d\.]+))?$/);
            if (!match) {
                throw new Error("Invalid NPM URL");
            }
            const pkgName = match[1];
            const npmversion = match[3] || 'latest';
            const resp = await fetch(`https://registry.npmjs.org/${pkgName}/${npmversion}`);
            // get github URL from NPM package metadata
            const metadata = await resp.json();
            version = npmversion !== 'latest' ? npmversion : metadata?.version;
            if (!packageName){
                formattedName = metadata?.name;
                formattedName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1).toLowerCase();
            }
            const tarball = metadata?.dist?.tarball;
            const tarballResp = await fetch(tarball);
            const content = Buffer.from(await tarballResp.arrayBuffer());
            zipContent = Buffer.from(content);
            packageData['Content'] = content.toString('base64');
        }
        else{
            // let githubURL: string = packageURL;
            // if (githubURL && githubURL.startsWith("git+https://")) {
            //     githubURL = githubURL.replace(/^git\+/, "").replace(/\.git$/, "");
            // }
            // const parameterName = "github-token";
            // const command = new GetParameterCommand({
            //     Name: parameterName,
            //     WithDecryption: true,
            // });
            // const response = await ssmClient.send(command);
            // const githubToken = response.Parameter?.Value || '';
            // const octokit = new Octokit({ auth: githubToken });
            // let { owner, repo, branch } = extractownerrepo(githubURL);
            // if (!branch){
            //     const {data: defaultBranch} = await octokit.request(
            //         'GET /repos/{owner}/{repo}',
            //         {
            //             owner: owner,
            //             repo: repo
            //         }
            //     );
            //     branch = defaultBranch.default_branch;
            // }
            // const {data: zipballdata} = await octokit.request(
            //     'GET /repos/{owner}/{repo}/zipball/{ref}',
            //     {
            //         owner: owner,
            //         repo: repo,
            //         ref: branch
            //     }
            // ) as {data: Buffer};
            // zipContent = Buffer.from(zipballdata.toString('base64'), 'base64');
            // // now fetch version from package.json
            // const { data: packageJson } = await octokit.request(
            //     'GET /repos/{owner}/{repo}/contents/package.json',
            //     {
            //         owner: owner,
            //         repo: repo,
            //         ref: branch
            //     }
            // );
            // const packageJsonContent = Buffer.from(packageJson.content, 'base64').toString('utf-8');
            // const packageJsonData = JSON.parse(packageJsonContent);
            // version = packageJsonData.version;
        }

    } else {
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
      }
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
    const s3key = `packages/${formattedName}/${packageID}/package.zip`;
    await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: s3key,
        Body: zipContent,
        ContentType: 'application/zip'
    }));
    
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
        Timestamp: new Date().toISOString()
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
} catch (error: any) {
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