// src/API/apiCalls.ts
import { extractInfo } from '../utils.js';
import logger from '../logger.js';
export default class ApiCalls {
    url;
    callReturnCode;
    owner;
    repo;
    constructor(url, owner, repo) {
        this.url = url;
        this.owner = owner ?? '';
        this.repo = repo ?? '';
        this.callReturnCode = 0;
    }
    setOwner(owner) {
        this.owner = owner;
    }
    setRepo(repo) {
        this.repo = repo;
    }
    async checkErrors() {
        if (this.url === '') {
            logger.error('No URL provided');
            this.callReturnCode = 404;
            return false;
        }
        if (this.owner === '' || this.repo === '') {
            logger.warn('No owner or repo provided');
            const { owner, repo } = await extractInfo(this.url);
            this.setOwner(owner);
            this.setRepo(repo);
        }
        this.callReturnCode = 200;
        return true;
    }
    async callAPI() {
        if (!(await this.checkErrors())) {
            logger.error('Error occurred during API call');
            return;
        }
        //await this.handleAPI();
        return this.callReturnCode;
    }
}
