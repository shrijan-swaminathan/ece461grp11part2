import logger from '../logger.js';
import { Metrics } from './Metrics.js';
import GitHubApiCalls from '../API/GitHubApiCalls.js';

export class DependencyPinning extends Metrics {
    private metricCode: number;

    constructor(apiCall: GitHubApiCalls) {
        super(apiCall);
        this.metricCode = 3; // Unique metric code
    }

    public async computeDependencyPinning(): Promise<number> {
        logger.info('Starting computation of Dependency Pinning metric.');

        try {
            // Fetch package.json and get dependency counts
            const { pinned, total } = await (this.apiCall as GitHubApiCalls).fetchPackageJson();

            // If no dependencies exist, return 1.0 as per requirements
            if (total === 0) {
                logger.info('No dependencies found. Returning perfect score.');
                return 1.0;
            }

            // Calculate the fraction
            const fraction = pinned / total;
            logger.info(`Dependency Pinning score computed: ${fraction}`);
            return fraction;

        } catch (error) {
            logger.error('Error computing Dependency Pinning:', error);
            return 0;
        }
    }
}
