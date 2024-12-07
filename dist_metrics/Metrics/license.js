import fs from 'fs-extra';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.js';
import logger from '../logger.js';
import { compatibleLicenses, incompatibleLicenses, contains, } from '../utils.js';
import Metrics from './Metrics.js';
export default class License extends Metrics {
    async getLicense() {
        const githubResponse = await this.apiCall.handleAPI();
        // Ensure license is present in GitHub API response
        if (githubResponse && githubResponse.license) {
            return githubResponse.license.key;
        }
        else {
            logger.info('License not found in GitHub API response');
            return 'nothing';
        }
    }
    async getUrl() {
        return this.apiCall.url;
    }
    async checkLicenseFile(dir, compatibleLicenses) {
        logger.info('Checking LICENSE file');
        const licenseFilePath = `${dir}/LICENSE`;
        try {
            const licenseFileExists = await fs.pathExists(licenseFilePath);
            if (!licenseFileExists) {
                logger.info('LICENSE file not found.');
                return false;
            }
            const licenseContent = await fs.readFile(licenseFilePath, 'utf-8');
            for (const license of compatibleLicenses) {
                if (licenseContent.includes(license)) {
                    logger.info(`Found compatible license: ${license}`);
                    return true;
                }
            }
            logger.info('No compatible license found in LICENSE file.');
            return false;
        }
        catch (err) {
            logger.error('Error while checking LICENSE file:', err);
            return false;
        }
    }
    async cloneRepository() {
        const dir = './t/tmp';
        const myUrl = await this.getUrl();
        await this.removeDirectoryIfExists(dir);
        logger.info('Cloning the repository');
        try {
            await git.clone({
                fs,
                http,
                dir,
                url: myUrl,
                depth: 1,
            });
            logger.info('Clone completed');
        }
        catch (err) {
            logger.error('Error cloning repository:', err);
        }
    }
    async isLicenseCompatible() {
        const dir = './t/tmp';
        await this.cloneRepository();
        // First check: README.md
        if (await this.checkReadmeFile(dir, compatibleLicenses)) {
            return 1;
        }
        // Second check: LICENSE file
        if (await this.checkLicenseFile(dir, compatibleLicenses)) {
            return 1;
        }
        // Third check: License API
        if (await this.checkLicenseAPI()) {
            return 1;
        }
        // If none of the checks pass, return 0
        return 0;
    }
    async checkLicenseAPI() {
        logger.info('Attempting to check license via API');
        const license = await this.getLicense();
        if (contains(compatibleLicenses, license) != -1) {
            logger.info(`Compatible license: ${license}`);
            return true;
        }
        else if (contains(incompatibleLicenses, license) != -1) {
            logger.info(`Incompatible license: ${license}`);
            return false;
        }
        else {
            logger.info(`Unknown license: ${license}`);
            return false;
        }
    }
    async checkReadmeFile(dir, compatibleLicenses) {
        const readmeFilePath = `${dir}/README.md`;
        try {
            const readmeFileExists = await fs.pathExists(readmeFilePath);
            if (!readmeFileExists) {
                logger.info('README.md file not found.');
                return false;
            }
            const readmeContent = await fs.readFile(readmeFilePath, 'utf-8');
            const licenseSectionIndex = readmeContent.indexOf('## License');
            if (licenseSectionIndex === -1) {
                logger.info('No "## License" section found in README.md.');
                return false;
            }
            const licenseText = readmeContent
                .substring(licenseSectionIndex + '## License'.length)
                .trim()
                .split('\n')[0]
                .trim();
            for (const license of compatibleLicenses) {
                if (licenseText.includes(license)) {
                    logger.info(`Found compatible license in README.md: ${license}`);
                    return true;
                }
            }
            logger.info('No compatible license found in README.md.');
            return false;
        }
        catch (err) {
            logger.error('Error while checking README.md file:', err);
            return false;
        }
    }
    async removeDirectoryIfExists(dir) {
        try {
            await fs.rm(dir, { recursive: true });
            logger.info(`Directory '${dir}' was removed.`);
        }
        catch (err) {
            logger.error('Error while removing directory:', err);
        }
    }
}
