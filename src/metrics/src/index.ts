import CLI from './cliClass.js';
import * as fsPromises from 'fs/promises'
import ApiCalls from './API/api.js'
import logger from './logger.js'
import { Correctness } from './Metrics/correctness.js'
import BusFactor from './Metrics/busFactor.js'
import License from './Metrics/license.js'
import { RampUpTime } from './Metrics/RampUp.js'
import { Responsiveness } from './Metrics/responsiveness.js'
import { ReviewedCode } from './Metrics/reviewedCode.js';
import { measureExecutionTime } from './utils.js'
import { DependencyPinning } from './Metrics/dependencyPinning.js';

interface MetricResult {
    BusFactor: number,
    BusFactorLatency: number,
    Correctness: number,
    CorrectnessLatency: number,
    RampUp: number,
    RampUpLatency: number,
    ResponsiveMaintainer: number,
    ResponsiveMaintainerLatency: number,
    LicenseScore: number,
    LicenseScoreLatency: number,
    GoodPinningPractice: number,
    GoodPinningPracticeLatency: number,
    PullRequest: number,
    PullRequestLatency: number,
    NetScore: number,
    NetScoreLatency: number
}


interface LambdaPayload {
    URL: string
}

export const handler = async (event: LambdaPayload) => {
    const inputUrl = event.URL;
    if (!inputUrl || typeof inputUrl !== 'string') {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid input. Please provide a valid GitHub URL in the "url" field.' }),
        };
    }
    
    console.log(`Processing URL: ${inputUrl}`);
    const cliObject = new CLI(inputUrl);
    const url = cliObject.getURL();
    console.log("URL: ", url);
    
    const apiCallsInstance = new ApiCalls(url)
    const apiList = await apiCallsInstance.getAPIlist();
    let api = apiList[0];
    console.log("API: ", api);
    const results: MetricResult[] = []
    try {
        // Instantiate metric calculators
        const correctnessCalculator = new Correctness(api)
        const busFactorCalculator = new BusFactor(api)
        const rampUpCalculator = new RampUpTime(api)
        const responsivenessCalculator = new Responsiveness(api)
        const licenseCalculator = new License(api)
        const reviewedCodeCalculator = new ReviewedCode(api)
        const dependencyPinningCalculator = new DependencyPinning(api)
        console.log("TESTING1", api.owner, api.repo);
        // Measure execution time of each metric calculation
        const [
            resCorrectness,
            resBusFactor,
            resRampUp,
            resResponsiveness,
            resLicense,
            resReviewedCode,
            resDependencyPinning
        ] = await Promise.all([
            measureExecutionTime(() => correctnessCalculator.computeCorrectness()),
            measureExecutionTime(() => busFactorCalculator.calcBusFactor(api.owner, api.repo)),
            measureExecutionTime(() => rampUpCalculator.computeRampUpTime()),
            measureExecutionTime(() => responsivenessCalculator.ComputeResponsiveness()),
            measureExecutionTime(() => licenseCalculator.checkLicenseAPI()),
            measureExecutionTime(() => reviewedCodeCalculator.computeReviewedCode()),
            measureExecutionTime(() => dependencyPinningCalculator.computeDependencyPinning())
        ])
        console.log("TESTING2");
        // Get scores and times
        const CorrectnessScore = resCorrectness.result || 0
        const BusFactorScore = resBusFactor.result || 0
        const RampUpScore = resRampUp.result || 0
        const ResponsivenessScore = resResponsiveness.result || 0
        const LicenseScore = resLicense.result
        const ReviewedCodeScore = resReviewedCode.result || 0
        const DependencyPinningScore = resDependencyPinning.result || 0
    
        const CorrectnessTime = resCorrectness.time || 0
        const BusFactorTime = resBusFactor.time || 0
        const RampUpTimeTime = resRampUp.time || 0
        const ResponsivenessTime = resResponsiveness.time || 0
        const LicenseTime = resLicense.time || 0
        const ReviewedCodeTime = resReviewedCode.time || 0
        const DependencyPinningTime = resDependencyPinning.time || 0

        let NetScore: number
        // Calculate NetScore
        if (LicenseScore == false) {
            NetScore = 0
        }
        else {
            NetScore = ((CorrectnessScore +
                        BusFactorScore +
                        RampUpScore +
                        ResponsivenessScore +
                        ReviewedCodeScore +
                        DependencyPinningScore) / 6)
        }
        const NetScore_Latency = parseFloat(
            (
                CorrectnessTime +
                BusFactorTime +
                RampUpTimeTime +
                ResponsivenessTime +
                LicenseTime + 
                ReviewedCodeTime +
                DependencyPinningTime
            ).toFixed(3)
        )
        console.log("TESTING3");
        // Collect results
        const result: MetricResult = {
            BusFactor: parseFloat(BusFactorScore.toFixed(2)),
            BusFactorLatency: parseFloat(BusFactorTime.toFixed(3)),
            Correctness: parseFloat(CorrectnessScore.toFixed(2)),
            CorrectnessLatency: parseFloat(CorrectnessTime.toFixed(3)),
            RampUp: parseFloat(RampUpScore.toFixed(2)),
            RampUpLatency: parseFloat(RampUpTimeTime.toFixed(3)),
            ResponsiveMaintainer: parseFloat(ResponsivenessScore.toFixed(2)),
            ResponsiveMaintainerLatency: parseFloat(ResponsivenessTime.toFixed(3)),
            LicenseScore: parseFloat(LicenseScore == false ? "0" : "1"),
            LicenseScoreLatency: parseFloat(LicenseTime.toFixed(3)),
            GoodPinningPractice: parseFloat(DependencyPinningScore.toFixed(2)),
            GoodPinningPracticeLatency: parseFloat(DependencyPinningTime.toFixed(3)),
            PullRequest: parseFloat(ReviewedCodeScore.toFixed(2)),
            PullRequestLatency: parseFloat(ReviewedCodeTime.toFixed(3)),
            NetScore: parseFloat(NetScore.toFixed(2)),
            NetScoreLatency: parseFloat(NetScore_Latency.toFixed(3))
        }
        console.log("Result: ", result);
        results.push(result);
    } catch (error) {
        logger.error(`Error processing API ${api.url}:`, error)
    }
    console.log("Result: ", results[0]);
    // Output results
    return {
        statusCode: 200,
        body: results[0]
    };
}
