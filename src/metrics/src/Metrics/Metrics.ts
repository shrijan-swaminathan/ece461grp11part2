import GitHubApiCalls from '../API/GitHubApiCalls.js';
import ApiCalls from '../API/api.js';
import { measureExecutionTime } from '../utils.js'


export default class Metrics {
    protected apiCall: GitHubApiCalls;
    protected token: string | undefined;
    private netScore: number

    constructor(apiCall: GitHubApiCalls) {
        this.token = process.env.GITHUB_TOKEN;
        this.apiCall = apiCall;
        this.netScore = 0;
    }
}
export { Metrics };
