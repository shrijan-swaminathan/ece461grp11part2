/**
 * Extracts owner and repository information from a GitHub URL.
 * @param packageURL - The GitHub repository URL
 * @returns An object containing owner, repo, and optional branch names
 * @throws Error if the URL is not a valid GitHub repository URL
 */

export function extractownerrepo(packageURL: string): { owner: string, repo: string, branch?: string } {
    // Given a GitHub URL, extract the owner, repo, and optionally the branch
    let owner = '';
    let repo = '';
    let branch = '';
    
    if (packageURL.includes('github.com')) {
        // Remove trailing "/" if exists
        packageURL = packageURL.replace(/\/$/, '');
        
        // Match the GitHub URL for the owner, repo, and optional branch
        const match = packageURL.match(/^(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?$/);
        
        if (!match) {
            throw new Error("Invalid GitHub URL");
        }
        
        // Extract owner and repo from the URL
        owner = match[1];
        repo = match[2];
        
        // Extract the branch if it exists
        if (match[3]) {
            branch = match[3];
        }
    }
    return { owner, repo, branch };
}
