import GitHubApiCalls from '../API/GitHubApiCalls.js';
import ApiCalls from '../API/api.js';
import { Metrics } from './Metrics.js';
import logger from '../logger.js';


export class RampUpTime extends Metrics{
    private metricCode: number;
    
    constructor(apiCall: GitHubApiCalls) {
        super(apiCall);
        this.metricCode = 2;
    }



    public async computeRampUpTime(): Promise<number> {
        logger.info('Starting ramp-up time computation')
        const response = await this.apiCall.handleAPI()

        if (!response){
            logger.error('No response from API')
            return -1
        } 


        let rampUpScore = 0;

        // The approach taken to calculate rampscore is a datascience based approach where the variables are normalized using log normalization
        // then multiplied by the weight of each variable respectively to get the final score
        
        if (this.apiCall instanceof GitHubApiCalls) { // We use nullish coalescing to check if certain variables might return undefined or null
            logger.verbose('Processing GitHub API response');

            const normalizedStargazers = await this.normalizeLog(response.stargazers_count, 10000);
            const normalizedForks = await this.normalizeLog(response.forks_count, 10000);
            const normalizedOpenIssues = 1 - (await this.normalizeLog((response.open_issues_count ?? 0), 1000)); // Open issues could be undefined or null
            const normalizedWatchers = await this.normalizeLog((response.watchers_count ?? 0), 3000); // Normalized watchers could be undefined or null
            const wikiScore = response.has_wiki ? 1 : 0;
            const pagesScore = response.has_pages ? 1 : 0;
            const discussionsScore = response.has_discussions ? 1 : 0;
            
            const readmeContent = await this.apiCall.fetchReadme();
            const readmeLines = readmeContent ? readmeContent.split('\n').length : 0;
            const normalizedReadmeLength = await this.normalizeLog(readmeLines, 400);

            const weightStargazers = 0.10;
            const weightForks = 0.10;
            const weightOpenIssues = 0.15;
            const weightWatchers = 0.05;
            const weightWiki = 0.15;
            const weightPages = 0.10;
            const weightDiscussions = 0.10;
            const readMe = 0.25;

            rampUpScore = (normalizedStargazers * weightStargazers) + (normalizedForks * weightForks) + (normalizedOpenIssues * weightOpenIssues) +
                            (normalizedWatchers * weightWatchers) + (wikiScore * weightWiki) + (pagesScore * weightPages) + (discussionsScore * weightDiscussions) + (normalizedReadmeLength * readMe);

            logger.debug(`Calculated GitHub ramp-up score: ${rampUpScore}`);

        } 
        logger.info(`Final ramp-up score: ${rampUpScore}`);
        return rampUpScore;
    }

    // Log normalization function
    private async normalizeLog(
        value: number,
        maxValue: number
    ): Promise<number> {
        return Math.log(value + 1) / Math.log(maxValue + 1)
    }

}