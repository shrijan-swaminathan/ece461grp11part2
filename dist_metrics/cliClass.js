import logger from './logger.js';
export default class CLI {
    url;
    cliError;
    constructor(url) {
        this.url = url;
        this.cliError = false;
    }
    printURL() {
        logger.info(`URL: ${this.url}`);
    }
    getURL() {
        return this.url;
    }
}
