import logger from '../logger.js';
import { Metrics } from './Metrics.js';
import GitHubApiCalls from '../API/GitHubApiCalls.js';

export class ReviewedCodeFraction extends Metrics {
    private metricCode: number;
    constructor(apiCall: any) {
        super(apiCall);
        this.metricCode = 5;
    }
    public async computeReviewedCodeFraction(): Promise<number> {
        logger.info('Starting computation of Reviewed Code Fraction metric.');
        try {
            //get all merged prs
            const mergedPRs = await (this.apiCall as GitHubApiCalls).fetchMergedPullRequests();
            if(!mergedPRs || mergedPRs.length === 0)
            {
                logger.error('No merged pull requests found for this repo');
                return 0;
            }
            const prNumbers = mergedPRs.map((pr) => pr.number);

            //get all reviewed PRs
            const reviewedCount = await (this.apiCall as GitHubApiCalls).fetchReviewedPullRequests(prNumbers);

            //compute fractions
            const reviewedCodeFraction = prNumbers.length > 0 ? reviewedCount / prNumbers.length : 0;
            
            logger.info(`Reviewed Code Fraction computed: ${reviewedCodeFraction}`);
            return reviewedCodeFraction;
        }
        catch (error) {
            logger.error('Error while processing GitHub API response');
            return -1;
        }
    }
}