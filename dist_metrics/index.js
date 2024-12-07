import CLI from './cliClass.js';
import * as fsPromises from 'fs/promises';
import ApiCalls from './API/api.js';
import logger from './logger.js';
import { Correctness } from './Metrics/correctness.js';
import BusFactor from './Metrics/busFactor.js';
import License from './Metrics/license.js';
import { RampUpTime } from './Metrics/RampUp.js';
import { Responsiveness } from './Metrics/responsiveness.js';
import { measureExecutionTime } from './utils.js';
const cliObject = new CLI("https://github.com/lodash/lodash");
const url = cliObject.getURL();
const apiCallsInstance = new ApiCalls(url);
const apiList = await apiCallsInstance.getAPIlist();
let api = apiList[0];
const results = [];
try {
    // Instantiate metric calculators
    const correctnessCalculator = new Correctness(api);
    const busFactorCalculator = new BusFactor(api);
    const rampUpCalculator = new RampUpTime(api);
    const responsivenessCalculator = new Responsiveness(api);
    const licenseCalculator = new License(api);
    console.log("TESTING1", api.owner, api.repo);
    // Measure execution time of each metric calculation
    const [resCorrectness, resBusFactor, resRampUp, resResponsiveness, resLicense,] = await Promise.all([
        measureExecutionTime(() => correctnessCalculator.computeCorrectness()),
        measureExecutionTime(() => busFactorCalculator.calcBusFactor(api.owner, api.repo)),
        measureExecutionTime(() => rampUpCalculator.computeRampUpTime()),
        measureExecutionTime(() => responsivenessCalculator.ComputeResponsiveness()),
        measureExecutionTime(() => licenseCalculator.checkLicenseAPI()),
    ]);
    console.log("TESTING2");
    // Get scores and times
    const CorrectnessScore = resCorrectness.result || 0;
    const BusFactorScore = resBusFactor.result || 0;
    const RampUpScore = resRampUp.result || 0;
    const ResponsivenessScore = resResponsiveness.result || 0;
    const LicenseScore = resLicense.result;
    const CorrectnessTime = resCorrectness.time || 0;
    const BusFactorTime = resBusFactor.time || 0;
    const RampUpTimeVal = resRampUp.time || 0;
    const ResponsivenessTime = resResponsiveness.time || 0;
    const LicenseTime = resLicense.time || 0;
    let NetScore;
    // Calculate NetScore
    if (LicenseScore == false) {
        NetScore = 0;
    }
    else {
        NetScore = ((CorrectnessScore +
            BusFactorScore +
            RampUpScore +
            ResponsivenessScore) / 4);
    }
    const NetScore_Latency = parseFloat((CorrectnessTime +
        BusFactorTime +
        RampUpTimeVal +
        ResponsivenessTime +
        LicenseTime).toFixed(3));
    console.log("TESTING3");
    // Collect results
    const result = {
        URL: api.url,
        NetScore: parseFloat(NetScore.toFixed(2)),
        NetScore_Latency: NetScore_Latency,
        RampUp: parseFloat(RampUpScore.toFixed(2)),
        RampUp_Latency: parseFloat(RampUpTimeVal.toFixed(3)),
        Correctness: parseFloat(CorrectnessScore.toFixed(2)),
        Correctness_Latency: parseFloat(CorrectnessTime.toFixed(3)),
        BusFactor: parseFloat(BusFactorScore.toFixed(2)),
        BusFactor_Latency: parseFloat(BusFactorTime.toFixed(3)),
        ResponsiveMaintainer: parseFloat(ResponsivenessScore.toFixed(2)),
        ResponsiveMaintainer_Latency: parseFloat(ResponsivenessTime.toFixed(3)),
        License: parseFloat(LicenseScore == false ? "0" : "1"),
        License_Latency: parseFloat(LicenseTime.toFixed(3)),
    };
    results.push(result);
}
catch (error) {
    logger.error(`Error processing API ${api.url}:`, error);
}
console.log("Result: ", results[0]);
// Output results
await fsPromises.writeFile('results.json', JSON.stringify(results));
console.log('Results written to results.json');
process.exit(0);
