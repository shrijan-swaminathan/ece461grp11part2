import CLI from './cliClass.js';
import * as fsPromises from 'fs/promises'
import ApiCalls from './API/api.js'
import logger from './logger.js'
import { Correctness } from './Metrics/correctness.js'
import BusFactor from './Metrics/busFactor.js'
import License from './Metrics/license.js'
import { RampUpTime } from './Metrics/RampUp.js'
import { Responsiveness } from './Metrics/responsiveness.js'
import { ReviewedCodeFraction } from './Metrics/reviewedCodeFraction.js';
import { measureExecutionTime } from './utils.js'

interface MetricResult {
    URL: string
    NetScore: number
    NetScore_Latency: number
    RampUp: number
    RampUp_Latency: number
    Correctness: number
    Correctness_Latency: number
    BusFactor: number
    BusFactor_Latency: number
    ResponsiveMaintainer: number
    ResponsiveMaintainer_Latency: number
    License: number
    License_Latency: number
    ReviewedCodeFraction: number
    ReviewedCodeFraction_Latency: number
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
        const reviewedCodeCalculator = new ReviewedCodeFraction(api)
        console.log("TESTING1", api.owner, api.repo);
        // Measure execution time of each metric calculation
        const [
            resCorrectness,
            resBusFactor,
            resRampUp,
            resResponsiveness,
            resLicense,
            resReviewedCode
        ] = await Promise.all([
            measureExecutionTime(() => correctnessCalculator.computeCorrectness()),
            measureExecutionTime(() => busFactorCalculator.calcBusFactor(api.owner, api.repo)),
            measureExecutionTime(() => rampUpCalculator.computeRampUpTime()),
            measureExecutionTime(() => responsivenessCalculator.ComputeResponsiveness()),
            measureExecutionTime(() => licenseCalculator.checkLicenseAPI()),
            measureExecutionTime(() => reviewedCodeCalculator.computeReviewedCodeFraction())
        ])
        console.log("TESTING2");
        // Get scores and times
        const CorrectnessScore = resCorrectness.result || 0
        const BusFactorScore = resBusFactor.result || 0
        const RampUpScore = resRampUp.result || 0
        const ResponsivenessScore = resResponsiveness.result || 0
        const LicenseScore = resLicense.result
        const reviewedCodeScore = resReviewedCode.result || 0
    
        const CorrectnessTime = resCorrectness.time || 0
        const BusFactorTime = resBusFactor.time || 0
        const RampUpTimeVal = resRampUp.time || 0
        const ResponsivenessTime = resResponsiveness.time || 0
        const LicenseTime = resLicense.time || 0
        const reviewedCodeTime = resReviewedCode.time || 0

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
                        reviewedCodeScore) / 5)
        }
        const NetScore_Latency = parseFloat(
            (
                CorrectnessTime +
                BusFactorTime +
                RampUpTimeVal +
                ResponsivenessTime +
                LicenseTime + 
                reviewedCodeTime
            ).toFixed(3)
        )
        console.log("TESTING3");
        // Collect results
        const result: MetricResult = {
            URL: api.url,
            NetScore: parseFloat(NetScore.toFixed(2)),
            NetScore_Latency: NetScore_Latency,
            RampUp: parseFloat(RampUpScore.toFixed(2)),
            RampUp_Latency: parseFloat(RampUpTimeVal.toFixed(3)),
            Correctness: parseFloat(CorrectnessScore.toFixed(2)),
            Correctness_Latency: parseFloat(CorrectnessTime.toFixed(3)),
            BusFactor: parseFloat(BusFactorScore.toFixed(2)),
            BusFactor_Latency: parseFloat(BusFactorTime.toFixed(3)),
            ResponsiveMaintainer: parseFloat(
                ResponsivenessScore.toFixed(2)
            ),
            ResponsiveMaintainer_Latency: parseFloat(
                ResponsivenessTime.toFixed(3)
            ),
            License: parseFloat(LicenseScore == false ? "0" : "1"),
            License_Latency: parseFloat(LicenseTime.toFixed(3)),
            ReviewedCodeFraction: parseFloat(reviewedCodeScore.toFixed(2)),
            ReviewedCodeFraction_Latency: parseFloat(reviewedCodeTime.toFixed(3))
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
