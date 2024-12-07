export default class Metrics {
    apiCall;
    token;
    netScore;
    constructor(apiCall) {
        this.token = process.env.GITHUB_TOKEN;
        this.apiCall = apiCall;
        this.netScore = 0;
    }
}
export { Metrics };
