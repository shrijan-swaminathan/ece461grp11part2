import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as readline from 'readline'
import ApiCalls from './API/api.js'
import logger from './logger.js'
import { Correctness } from './Metrics/correctness.js'
import BusFactor from './Metrics/busFactor.js'
import License from './Metrics/license.js'
import { RampUpTime } from './Metrics/RampUp.js'
import { Responsiveness } from './Metrics/responsiveness.js'
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
}

export default class CLI {
    private url: string
    private cliError: boolean

    constructor(url: string) {
        this.url = url;
        this.cliError = false;
    }

    public printURL(): void {
        logger.info(`URL: ${this.url}`);
    }

    public getURL(): string {
        return this.url;
    }
}
