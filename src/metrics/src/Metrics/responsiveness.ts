import { all } from 'axios'
import ApiCalls from '../API/api.js'
import GitHubApiCalls from '../API/GitHubApiCalls.js'
import { differenceInHours, extractInfo } from '../utils.js'
import { Octokit } from '@octokit/core'
import 'dotenv/config'
import { extractInfoFromSSH } from '../utils.js'
import logger from '../logger.js'
import Metrics from './Metrics.js'
import { measureExecutionTime } from '../utils.js'

export class Responsiveness extends Metrics {
    private metricCode: number

    constructor(apiCall: GitHubApiCalls) {
        super(apiCall)
        this.metricCode = 3
    }

    async ComputeResponsiveness(): Promise<number> {
        let score = 0
        const allIssues = await (this.apiCall as GitHubApiCalls).fetchIssues()
        logger.debug(
            `owner is ${this.apiCall.owner} and repo is ${this.apiCall.repo}`
        )
        let counter = 0
        for (const issue of allIssues) {
            if (issue.pull_request == null) counter++
            const issueComments: Array<{ created_at: string }> = await (
                this.apiCall as GitHubApiCalls
            ).fetchIssueComments(issue.number)
            let diffTime: number
            if (issueComments[0]) {
                diffTime = differenceInHours(
                    issue.created_at,
                    issueComments[0].created_at
                )
                diffTime = diffTime / (7 * 24)
                diffTime = Math.min(diffTime, 1)
            } else if (issue.closed_at) {
                if (issue.pull_request != null)
                    diffTime =
                        differenceInHours(issue.created_at, issue.closed_at) /
                        (15 * 24)
                else
                    diffTime =
                        differenceInHours(issue.created_at, issue.closed_at) /
                        (7 * 24)
                diffTime = Math.min(diffTime, 1)
            } else {
                diffTime = 1
            }
            score += diffTime
            logger.verbose(
                `avg response time for issue ${issue.number} is ${diffTime}`
            )
            if (counter > 100) break
        }
        logger.info(
            `analyzed ${counter} different issues and ${100 - counter} pull requests`
        )
        return 1 - score / allIssues.length
    }
}