// src/API/GitHubApiCalls.ts
import ApiCalls from './apiCalls.js'
// import isLicenseCompatible from '../Metrics/license.js'
import 'dotenv/config'
import { Octokit } from '@octokit/core'
import logger from '../logger.js'
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";


const ssmClient = new SSMClient({ region: "us-east-2" });

export async function getGithubToken() {
    const parameterName = "github-token";
    const command = new GetParameterCommand({
        Name: parameterName,
        WithDecryption: true,
    });
    const response = await ssmClient.send(command);
    const githubToken = response.Parameter?.Value || '';
    console.log('githubToken: ', githubToken);
    return githubToken;
}

export default class GitHubApiCalls extends ApiCalls {
    octokit: Octokit | null = null;

    constructor(url: string, owner?: string, repo?: string) {
        super(url, owner, repo)
    }

    async initialize(): Promise<void> {
        const githubToken = await getGithubToken();
        console.log("GithubToken: ", githubToken);
        this.octokit = new Octokit({
            auth: githubToken,
        });
    }
    async fetchPackageJson():Promise<{ pinned: number, total: number }> {
        try {
            const response = await this.octokit?.request(
                'GET /repos/{owner}/{repo}/contents/package.json',
                {
                    owner: this.owner,
                    repo: this.repo,
                }
            );
            if (!response?.data) {
                logger.warn('No package.json found in repository.');
                return { pinned: 0, total: 0 };
            }
            // Decode base64 content
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            const packageJson = JSON.parse(content);
            // Combine dependencies and devDependencies
            const dependencies = {
                ...packageJson.dependencies || {},
                ...packageJson.devDependencies || {}
            };
            // calculate total Dependencies
            const totalDeps = Object.keys(dependencies).length;
            if (totalDeps === 0) {
                return { pinned: 0, total: 0 };
            }
            // count pinned dependencies using regex
            const pinnedDeps = Object.values(dependencies as Record<string, string>).filter((version: string) => {
                const regex = /^\d+\.\d+\.\d+$|^\d+\.\d+\.x$/;
                return regex.test(version);
            }).length;
        
            return { pinned: pinnedDeps, total: totalDeps };
        } catch (error) {
            logger.error('Error fetching package.json:', error);
            return { pinned: 0, total: 0 };
        }
    }
    async fetchMergedPullRequests(): Promise<any[]> {
        try {
            const response = await this.octokit?.request('GET /repos/{owner}/{repo}/pulls', {
                owner: this.owner,
                repo: this.repo,
                state: 'closed',
                per_page: 100,
            });

            const pullRequests = response?.data || [];
            logger.info(`Fetched ${pullRequests.length} closed pull requests.`);

            // Filter only merged PRs
            return pullRequests.filter((pr: any) => pr.merged_at);
        } catch (error) {
            logger.error('Error fetching merged pull requests:', error);
            return [];
        }
    }
    async fetchReviewedPullRequests(prNumbers: number[]): Promise<number> {
        let reviewedCount = 0;

        await Promise.all(
            prNumbers.map(async (prNumber) => {
                try {
                    const response = await this.octokit?.request(
                        'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
                        {
                            owner: this.owner,
                            repo: this.repo,
                            pull_number: prNumber,
                        }
                    );

                    if ((response?.data || []).length > 0) {
                        reviewedCount++;
                    }
                } catch (error) {
                    logger.error(`Error fetching reviews for PR #${prNumber}:`, error);
                }
            })
        );

        return reviewedCount;
    }
    async fetchContributors(owner: string, repo: string): Promise<any[]> {
        try {
            const response = await this.octokit?.request(
                'GET /repos/{owner}/{repo}/contributors',
                {
                    owner: owner,
                    repo: repo,
                    per_page: 100,
                }
            )

            // Return an array of contributors and their contributions
            return response!.data.map((contributor: any) => ({
                login: contributor.login,
                contributions: contributor.contributions,
            }))
        } catch (error) {
            logger.error(
                `Error fetching contributors for ${owner}/${repo}:`,
                error
            )
            return []
        }
    }

    async fetchReadme(): Promise<string | null> {
        try {
            const response = await this.octokit?.request(
                'GET /repos/{owner}/{repo}/readme',
                {
                    owner: this.owner,
                    repo: this.repo,
                }
            )
            if (response!.data && response!.data.content) {
                const readmeContent = Buffer.from(
                    response!.data.content,
                    'base64'
                ).toString('binary')
                return readmeContent
            } else {
                return null
            }
        } catch (error) {
            return null
        }
    }

    async handleAPI() {
        logger.info(`Making API call to GitHub: ${this.owner}/${this.repo}`);
        const response = await this.octokit?.request('GET /repos/{owner}/{repo}', {
            owner: this.owner,
            repo: this.repo,
        });
        return response!.data;
    }

    async fetchIssues(): Promise<any[]> {
        const response = await this.octokit?.request('GET /repos/{owner}/{repo}/issues', {
                owner: this.owner,
                repo: this.repo,
                per_page: 50,
                state: 'all',
            })
            .then((response: any) => response.data)
        return response
    }

    async fetchIssueComments(issue_no: number) {
        const response = await this.octokit?.request('GET /repos/{owner}/{repo}/issues/{issue_no}/comments', {
                owner: this.owner,
                repo: this.repo,
                issue_no: issue_no,
                per_page: 1,
            })
            .then((response: any) => response.data)
        return response
    }
}
