// src/API/api.ts
import GitHubApiCalls from './GitHubApiCalls.js';
import NpmApiCalls from './NpmApiCalls.js';
import { extractInfo } from '../utils.js';
import logger from '../logger.js';

export default class ApiCalls {
    inputURL: string[];
    callReturnCode: number;

    constructor(urls?: string[]) {
        this.inputURL = urls ?? [];
        this.callReturnCode = 0;
    }

    async callAPI(): Promise<number | void | GitHubApiCalls | NpmApiCalls> {
        if (!this.checkErrors()) {
            logger.error('No URL provided');
            return;
        }
        for (let url of this.inputURL) {
            const { type, owner, repo } = await extractInfo(url);
            if (type === 'unknown') {
                logger.warn(`Unknown URL: ${url}`);
                this.callReturnCode = 404;
                return this.callReturnCode;
            }

            if (type === 'github') {
                const githubApi = new GitHubApiCalls(url, owner, repo);
                if ((await githubApi.callAPI()) == 200) {
                    return githubApi;
                }
            } else if (type === 'npm') {
                const npmApi = new NpmApiCalls(url, owner, repo);
                if ((await npmApi.callAPI()) == 200) {
                    return npmApi;
                }
            }
        }

        this.callReturnCode = 200;
        return this.callReturnCode;
    }

    async getAPIlist(): Promise<(GitHubApiCalls | NpmApiCalls)[]> {
        let apiList: (GitHubApiCalls | NpmApiCalls)[] = [];
        if (!this.checkErrors()) {
            logger.error('No URL provided');
            return apiList;
        }
        for (let url of this.inputURL) {
            const { type, owner, repo } = await extractInfo(url);
            if (type === 'unknown') {
                logger.warn(`Unknown URL: ${url}`);
                this.callReturnCode = 404;
                return apiList;
            }

            if (type === 'github') {
                const githubApi = new GitHubApiCalls(url, owner, repo);
                if ((await githubApi.callAPI()) == 200) {
                    apiList.push(githubApi);
                }
            } else if (type === 'npm') {
                const npmApi = new NpmApiCalls(url, owner, repo);
                if ((await npmApi.callAPI()) == 200) {
                    apiList.push(npmApi);
                }
            }
        }

        this.callReturnCode = 200;
        return apiList;
    
    }

    getURL(): string[] {
        return this.inputURL;
    }

    checkErrors(): boolean {
        return this.getURL().length !== 0;
    }

    setURL(urls: string[]): void {
        this.inputURL = urls;
    }

    generateOutput(): string {
        if (this.checkErrors()) {
            return 'Error occurred during API call';
        } else {
            return 'API call was successful';
        }
    }
}
