// correctness.ts
import axios from 'axios';
import GitHubApiCalls from '../API/GitHubApiCalls.js';
import { Metrics } from './Metrics.js';
import logger from '../logger.js'; // Import the logger
export class Correctness extends Metrics {
    metricCode;
    weights = {
        testPresence: 0.25,
        openIssueRatio: 0.20,
        recencyScore: 0.20,
        ciPresence: 0.15,
        documentationPresence: 0.10,
        lintersPresence: 0.10,
    };
    constructor(apiCall) {
        super(apiCall);
        this.metricCode = 1;
    }
    async computeCorrectness() {
        logger.info('Starting computation of Correctness metric.');
        const factors = {};
        factors['testPresence'] = await this.testPresence();
        factors['openIssueRatio'] = 1 - (await this.openIssueRatio());
        factors['recencyScore'] = await this.recencyScore();
        factors['ciPresence'] = await this.ciPresence();
        factors['documentationPresence'] = await this.documentationPresence();
        factors['lintersPresence'] = await this.lintersPresence();
        logger.debug('Computed factors:', factors);
        let correctnessScore = 0;
        for (const key in factors) {
            correctnessScore += this.weights[key] * factors[key];
        }
        logger.info(`Correctness score computed: ${correctnessScore}`);
        return correctnessScore;
    }
    isGithubApiCall() {
        return this.apiCall instanceof GitHubApiCalls;
    }
    // Function to get headers for GitHub API requests
    getGithubHeaders() {
        const headers = {
            Accept: 'application/vnd.github.v3+json',
        };
        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }
        return headers;
    }
    async testPresence() {
        logger.info('Checking for test presence.');
        if (this.isGithubApiCall()) {
            const hasTestDirectory = (await this.hasGithubDirectory('test')) || (await this.hasGithubDirectory('tests'));
            logger.debug(`GitHub repo has test directory: ${hasTestDirectory}`);
            return hasTestDirectory ? 1.0 : 0.0;
        }
        else {
            logger.warn('Unknown API call type for test presence check.');
            return 0.0;
        }
    }
    async openIssueRatio() {
        logger.info('Calculating open issue ratio.');
        if (this.isGithubApiCall()) {
            const owner = this.apiCall.owner;
            const repo = this.apiCall.repo;
            const openIssuesCount = await this.getGithubOpenIssuesCount(owner, repo);
            const closedIssuesCount = await this.getGithubClosedIssuesCount(owner, repo);
            const totalIssues = openIssuesCount + closedIssuesCount;
            logger.debug(`Open issues: ${openIssuesCount}, Closed issues: ${closedIssuesCount}, Total issues: ${totalIssues}`);
            if (totalIssues === 0) {
                logger.warn('Total issues count is zero. Returning ratio as 0.0.');
                return 0.0;
            }
            return openIssuesCount / totalIssues;
        }
        else {
            logger.warn('Open issue ratio calculation is only applicable for GitHub repositories.');
            return 0.0;
        }
    }
    async recencyScore() {
        logger.info('Calculating recency score.');
        let lastCommitDate = null;
        if (this.isGithubApiCall()) {
            const owner = this.apiCall.owner;
            const repo = this.apiCall.repo;
            lastCommitDate = await this.getGithubLastCommitDate(owner, repo);
        }
        else {
            logger.warn('Recency score calculation is not applicable.');
            return 0.0;
        }
        if (!lastCommitDate) {
            logger.warn('Last commit/publish date is not available. Returning score as 0.0.');
            return 0.0;
        }
        const currentDate = new Date();
        const diffTime = Math.abs(currentDate.getTime() - lastCommitDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // Assuming packages updated within the last year (365 days) are recent
        const recencyScore = Math.max(0, (365 - diffDays) / 365);
        logger.debug(`Last update was ${diffDays} days ago. Recency score: ${recencyScore}`);
        return recencyScore;
    }
    async ciPresence() {
        logger.info('Checking for CI presence.');
        if (this.isGithubApiCall()) {
            const ciFiles = ['.travis.yml', '.circleci/config.yml', 'Jenkinsfile'];
            const ciDirectories = ['.github/workflows'];
            const ciPromises = ciFiles.map(file => this.hasGithubFile(file));
            const dirPromises = ciDirectories.map(dir => this.hasGithubDirectory(dir));
            const ciFilesExist = await Promise.all(ciPromises);
            const ciDirsExist = await Promise.all(dirPromises);
            const hasCi = ciFilesExist.includes(true) || ciDirsExist.includes(true);
            logger.debug(`CI presence: ${hasCi}`);
            return hasCi ? 1.0 : 0.0;
        }
        else {
            logger.warn('CI presence check is only applicable for GitHub repositories.');
            return 0.0;
        }
    }
    async documentationPresence() {
        logger.info('Checking for documentation presence.');
        if (this.isGithubApiCall()) {
            const hasReadme = (await this.hasGithubFile('README.md')) || (await this.hasGithubFile('README'));
            logger.debug(`GitHub repo has README: ${hasReadme}`);
            return hasReadme ? 1.0 : 0.0;
        }
        else {
            logger.warn('Documentation presence check is not applicable.');
            return 0.0;
        }
    }
    async lintersPresence() {
        logger.info('Checking for linters presence.');
        if (this.isGithubApiCall()) {
            const linterFiles = ['.eslintrc', '.eslintrc.js', '.eslint.json', '.tslint.json'];
            const linterPromises = linterFiles.map(file => this.hasGithubFile(file));
            const linterFilesExist = await Promise.all(linterPromises);
            const hasLinter = linterFilesExist.includes(true);
            logger.debug(`Linters presence in GitHub repo: ${hasLinter}`);
            return hasLinter ? 1.0 : 0.0;
        }
        else {
            logger.warn('Linters presence check is not applicable.');
            return 0.0;
        }
    }
    // Helper functions for GitHub
    async getGithubOpenIssuesCount(owner, repo) {
        try {
            const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers: this.getGithubHeaders() });
            const openIssues = response.data.open_issues_count || 0;
            logger.debug(`Fetched open issues count: ${openIssues}`);
            return openIssues;
        }
        catch (error) {
            logger.error('Error fetching open issues count:', error);
            return 0;
        }
    }
    async getGithubClosedIssuesCount(owner, repo) {
        try {
            const response = await axios.get(`https://api.github.com/search/issues?q=repo:${owner}/${repo}+type:issue+state:closed`, { headers: this.getGithubHeaders() });
            const closedIssues = response.data.total_count || 0;
            logger.debug(`Fetched closed issues count: ${closedIssues}`);
            return closedIssues;
        }
        catch (error) {
            logger.error('Error fetching closed issues count:', error);
            return 0;
        }
    }
    async getGithubLastCommitDate(owner, repo) {
        try {
            const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits`, { headers: this.getGithubHeaders() });
            const lastCommitDate = response.data[0]?.commit?.committer?.date;
            logger.debug(`Fetched last commit date: ${lastCommitDate}`);
            return lastCommitDate ? new Date(lastCommitDate) : null;
        }
        catch (error) {
            logger.error('Error fetching last commit date:', error);
            return null;
        }
    }
    async hasGithubFile(path) {
        const owner = this.apiCall.owner;
        const repo = this.apiCall.repo;
        try {
            await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, { headers: this.getGithubHeaders() });
            logger.debug(`File ${path} exists in GitHub repo.`);
            return true;
        }
        catch (error) {
            logger.debug(`File ${path} does not exist in GitHub repo.`);
            return false;
        }
    }
    async hasGithubDirectory(path) {
        // In GitHub API, files and directories are both 'contents'
        return this.hasGithubFile(path);
    }
}
