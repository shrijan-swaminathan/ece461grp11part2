import { differenceInHours } from '../utils.js';
import 'dotenv/config';
import logger from '../logger.js';
import Metrics from './Metrics.js';
export class Responsiveness extends Metrics {
    metricCode;
    constructor(apiCall) {
        super(apiCall);
        this.metricCode = 3;
    }
    async ComputeResponsiveness() {
        let score = 0;
        const allIssues = await this.apiCall.fetchIssues();
        logger.debug(`owner is ${this.apiCall.owner} and repo is ${this.apiCall.repo}`);
        let counter = 0;
        for (const issue of allIssues) {
            if (issue.pull_request == null)
                counter++;
            const issueComments = await this.apiCall.fetchIssueComments(issue.number);
            let diffTime;
            if (issueComments[0]) {
                diffTime = differenceInHours(issue.created_at, issueComments[0].created_at);
                diffTime = diffTime / (7 * 24);
                diffTime = Math.min(diffTime, 1);
            }
            else if (issue.closed_at) {
                if (issue.pull_request != null)
                    diffTime =
                        differenceInHours(issue.created_at, issue.closed_at) /
                            (15 * 24);
                else
                    diffTime =
                        differenceInHours(issue.created_at, issue.closed_at) /
                            (7 * 24);
                diffTime = Math.min(diffTime, 1);
            }
            else {
                diffTime = 1;
            }
            score += diffTime;
            logger.verbose(`avg response time for issue ${issue.number} is ${diffTime}`);
            if (counter > 100)
                break;
        }
        logger.info(`analyzed ${counter} different issues and ${100 - counter} pull requests`);
        return 1 - score / allIssues.length;
    }
}
