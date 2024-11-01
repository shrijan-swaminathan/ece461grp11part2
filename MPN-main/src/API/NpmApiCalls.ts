// src/API/NpmApiCalls.ts
// import isLicenseCompatible from '../Metrics/license.js';
import ApiCalls from './apiCalls.js'
import logger from '../logger.js'
import axios from 'axios'

interface Contributor {
    name?: string
    email?: string
    contributions?: number
}

export default class NpmApiCalls extends ApiCalls {
    async handleAPI() {
        logger.info(`Making API call to NPM: ${this.repo}`);
        try {
            const response = await axios.get(`https://registry.npmjs.org/${this.repo}`);
            return response.data; // Return the package data
        } catch (error) {
            logger.error(`Error fetching package info for ${this.repo}:`, error);
            throw error;
        }
    }

    async fetchContributors(): Promise<Contributor[]> {
        try {
            logger.info(`Fetching contributors for npm package: ${this.repo}`)
            const res = await fetch(
                `https://registry.npmjs.org/${this.repo}`
            ).then((response) => response.json())

            // Check if 'contributors' field exists; if not, fallback to 'maintainers'
            const contributors = res.contributors || res.maintainers || []

            if (contributors.length === 0) {
                logger.warn('No contributors found in the package metadata.')
                return []
            }

            const formattedContributors = contributors.map(
                (contributor: Contributor) => {
                    return {
                        login:
                            contributor.name || contributor.email || 'unknown',
                        contributions: 1,
                    }
                }
            )

            logger.info('Fetched contributors', formattedContributors)
            return formattedContributors
        } catch (error) {
            logger.error('Error fetching contributors:', error)
            return []
        }
    }
}
