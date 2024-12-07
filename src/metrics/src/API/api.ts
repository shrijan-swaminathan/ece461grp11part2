// src/API/api.ts
import GitHubApiCalls from './GitHubApiCalls.js';
import { extractInfo, normalizeGitHubUrl, getGitHubURLfromNPM } from '../utils.js';
import logger from '../logger.js';

export default class ApiCalls {
    inputURL: string;
    callReturnCode: number;

    constructor(url?: string) {
        this.inputURL = url ?? '';
        this.callReturnCode = 0;
    }

    async callAPI(): Promise<number | void | GitHubApiCalls> {
        if (!this.checkErrors()) {
            logger.error('No URL provided');
            console.log('No URL provided');
            return;
        }
        const url = this.inputURL;
        const { type, owner, repo } = await extractInfo(url);
        if (type === 'unknown') {
            logger.warn(`Unknown URL: ${url}`);
            console.log(`Unknown URL: ${url}`);
            this.callReturnCode = 404;
            return this.callReturnCode;
        }
        
        console.log(`Github url(?): ${url}`);
        const githubApi = new GitHubApiCalls(url, owner, repo);
        await githubApi.initialize();
        if ((await githubApi.callAPI()) == 200) {
            return githubApi;
        }
        this.callReturnCode = 200;
        return this.callReturnCode;
    }

    async getAPIlist(): Promise<(GitHubApiCalls)[]> {
        let apiList: (GitHubApiCalls)[] = [];
        if (!this.checkErrors()) {
            logger.error('No URL provided');
            return apiList;
        }
        let url = this.inputURL;
        const { type, owner, repo } = await extractInfo(url);
        if (type === 'unknown' || (type !== 'github' && type !== 'npm')) {
            logger.warn(`Unknown URL: ${url}`);
            this.callReturnCode = 404;
            return apiList;
        }
        if (type === 'npm') {
            // Grab github url from npm
            console.log('npm URL: ', url);
            // Call github api and get github link
            url = await getGitHubURLfromNPM(url);
            console.log('github URL: ', url);
        }
        url = await normalizeGitHubUrl(url);
        console.log('normalized github URL: ', url);
        //type is github after this point but we check it anyway
        const githubApi = new GitHubApiCalls(url);
        await githubApi.initialize();
        let status_code = await githubApi.callAPI();
        console.log('githubApi: ',status_code);
        if (status_code == 200) {
            apiList.push(githubApi);
        }
        this.callReturnCode = 200;
        return apiList;
    }

    getURL(): string {
        return this.inputURL;
    }

    checkErrors(): boolean {
        return this.getURL().length !== 0;
    }

    setURL(url: string): void {
        this.inputURL = url;
    }

    generateOutput(): string {
        if (this.checkErrors()) {
            return 'Error occurred during API call';
        } else {
            return 'API call was successful';
        }
    }
}
