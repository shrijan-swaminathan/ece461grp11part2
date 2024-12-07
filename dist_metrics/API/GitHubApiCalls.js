// src/API/GitHubApiCalls.ts
import ApiCalls from './apiCalls.js';
// import isLicenseCompatible from '../Metrics/license.js'
import 'dotenv/config';
import { Octokit } from '@octokit/core';
import logger from '../logger.js';
export default class GitHubApiCalls extends ApiCalls {
    octokit;
    constructor(url, owner, repo) {
        super(url, owner, repo);
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });
    }
    async fetchContributors(owner, repo) {
        try {
            const response = await this.octokit.request('GET /repos/{owner}/{repo}/contributors', {
                owner: owner,
                repo: repo,
                per_page: 100,
            });
            // Return an array of contributors and their contributions
            return response.data.map((contributor) => ({
                login: contributor.login,
                contributions: contributor.contributions,
            }));
        }
        catch (error) {
            logger.error(`Error fetching contributors for ${owner}/${repo}:`, error);
            return [];
        }
    }
    async fetchReadme() {
        try {
            const response = await this.octokit.request('GET /repos/{owner}/{repo}/readme', {
                owner: this.owner,
                repo: this.repo,
            });
            if (response.data && response.data.content) {
                const readmeContent = Buffer.from(response.data.content, 'base64').toString('binary');
                return readmeContent;
            }
            else {
                return null;
            }
        }
        catch (error) {
            return null;
        }
    }
    async handleAPI() {
        logger.info(`Making API call to GitHub: ${this.owner}/${this.repo}`);
        const response = await this.octokit.request('GET /repos/{owner}/{repo}', {
            owner: this.owner,
            repo: this.repo,
        });
        return response.data;
    }
    async fetchIssues() {
        const response = await this.octokit
            .request('GET /repos/{owner}/{repo}/issues', {
            owner: this.owner,
            repo: this.repo,
            per_page: 50,
            state: 'all',
        })
            .then((response) => response.data);
        return response;
    }
    async fetchIssueComments(issue_no) {
        const response = await this.octokit
            .request('GET /repos/{owner}/{repo}/issues/{issue_no}/comments', {
            owner: this.owner,
            repo: this.repo,
            issue_no: issue_no,
            per_page: 1,
        })
            .then((response) => response.data);
        return response;
    }
}
