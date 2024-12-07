import logger from './logger.js'
export async function normalizeGitHubUrl(url: string): Promise<string> {
    if (url.startsWith('git+ssh://git@github.com/')) {
        return url.replace('git+ssh://git@github.com/', 'https://github.com/').replace('.git', '');
    }
    if (url.startsWith('ssh://git@github.com/')) {
        return url.replace('ssh://git@github.com/', 'https://github.com/').replace('.git', '');
    }
    if (url.startsWith('git+https://')) {
        return url.replace('git+', '').replace('.git', '');
    }
    if (url.startsWith('https://github.com/')) {
        return url.replace('.git', '');
    }
    // If no valid format is detected, return the original URL
    return url;
}
export async function getGitHubURLfromNPM(url: string): Promise<string> {
    let packageURL = url;
    packageURL = packageURL.replace(/\/$/, '');
    const match = packageURL.match(/^(https?:\/\/(?:www\.)?npmjs\.com\/package\/([\w-]+)(?:\/v\/(\d+\.\d+\.\d+))?)$/);
    if (!match) {
        throw new Error("Invalid NPM URL");
    }
    const pkgName = match[2];
    const npmversion = match[3] || 'latest';
    
    console.log(`Fetching package ${pkgName} version ${npmversion}`);
    // Fetch package metadata from registry
    const resp = await fetch(`https://registry.npmjs.org/${pkgName}/${npmversion}`);
    if (!resp.ok) {
        throw new Error("Package not found in NPM registry");
    }
    
    const metadata = await resp.json();
    const githubURL = metadata.repository.url;
    return githubURL;
}
export async function extractInfo(
    url: string
): Promise<{ type: string; owner: string; repo: string }> {
    let splitURL = url.split('/')
    if (splitURL[2] === 'github.com')
        return { type: 'github', owner: splitURL[3], repo: splitURL[4] }
    else if (splitURL[2] === 'www.npmjs.com')
        return { type: 'npm', owner: splitURL[3], repo: splitURL[4] }
    else return { type: 'unknown', owner: '', repo: '' }
}

export function contains(arr: string[], q: string): number {
    return arr.findIndex((item) => q.toLowerCase() === item.toLowerCase())
}

export function differenceInHours(date1: string, date2: string): number {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    const diffInMs = Math.abs(d2.getTime() - d1.getTime())
    return diffInMs / (1000 * 60 * 60)
}

export async function extractInfoFromSSH(sshUrl: string): Promise<{
    owner: string
    repo: string
}> {
    const regex = /^git\+ssh:\/\/git@github\.com\/(.+?)\/(.+?)\.git$/ // Adjusted to match 'git+ssh' format
    const match = sshUrl.match(regex)
    if (match && match.length === 3) {
        return { owner: match[1], repo: match[2] }
    } else {
        logger.error('Invalid SSH URL format:', sshUrl)
        return { owner: '', repo: '' }
    }
}

export async function measureExecutionTime<T>(func: () => Promise<T>): Promise<{ result: T, time: number }> {
    try {
        const startTime = process.hrtime(); // High-resolution time
        const result = await func();
        const endTime = process.hrtime(startTime);
        const timeInSeconds = endTime[0] + endTime[1] / 1e9; // Convert to seconds
        return { result, time: timeInSeconds };
    } catch (error) {
        logger.error('Error measuring execution time:', error);
        throw {error: -1, time: 0};
    }
}

export const compatibleLicenses = [
    'Apache',
    'Artistic',
    'BSL',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'BSD-3-Clause-Clear',
    '0BSD',
    'CC0',
    'ECL',
    'EPL-1.0',
    'EPL',
    'GPL-2.0',
    'GPL',
    'LGPL-2.1',
    'LGPL',
    'ISC',
    'MIT',
    'MPL',
    'PostgreSQL',
    'NCSA',
    'Unlicense',
    'Zlib',
    'none',
    'other',
]

export const incompatibleLicenses = [
    'AFL-3.0',
    'BSD-4-Clause',
    'CC',
    'CC-BY-4.0',
    'CC-BY-SA-4.0',
    'WTFPL',
    'EUPL-1.1',
    'AGPL-3.0',
    'LPPL-1.3c',
    'MS-PL',
    'OSL-3.0',
    'OFL-1.1',
]
