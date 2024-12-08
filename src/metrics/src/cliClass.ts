import logger from './logger.js'

export default class CLI {
    private url: string
    private cliError: boolean

    constructor(url: string) {
        this.url = url;
        this.cliError = false;
    }

    public printURL(): void {
        logger.info(`URL: ${this.url}`);
    }

    public getURL(): string {
        return this.url;
    }
}
