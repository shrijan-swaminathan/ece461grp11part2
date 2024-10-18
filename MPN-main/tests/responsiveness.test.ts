/// <reference types="vitest" />

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Responsiveness } from '../src/Metrics/responsiveness.js'
import GitHubApiCalls from '../src/API/GitHubApiCalls.js'
import NpmApiCalls from '../src/API/NpmApiCalls.js'
import { differenceInHours } from '../src/utils.js'
import logger from '../src/logger.js'

// Mock GitHubApiCalls and the methods used in Responsiveness
vi.mock('../src/API/GitHubApiCalls.js', () => {
    return {
        default: vi.fn().mockImplementation(() => {
            return {
                fetchIssues: vi.fn(),
                fetchIssueComments: vi.fn(),
            };
        }),
    };
});

describe('Responsiveness Class', () => {
    let responsivenessCalculator: Responsiveness;
    let gitHubApiMock: any;

    beforeEach(() => {
        // Clear mocks and reset the responsiveness instance
        vi.clearAllMocks();

        // Mock GitHubApiCalls
        gitHubApiMock = new GitHubApiCalls('ownerName', 'repoName');
        gitHubApiMock.fetchIssues = vi.fn();
        gitHubApiMock.fetchIssueComments = vi.fn();

        // Create the Responsiveness instance
        responsivenessCalculator = new Responsiveness(gitHubApiMock);
    });

    it('should calculate responsiveness when there are issues and comments', async () => {
        // Mock GitHub issues response
        gitHubApiMock.fetchIssues.mockResolvedValueOnce([
            {
                number: 1,
                title: 'Issue 1',
                created_at: '2023-09-20T12:00:00Z',
                closed_at: '2023-09-22T12:00:00Z',
                comments_url:
                    'https://api.github.com/repos/owner/repo/issues/1/comments',
            },
        ]);

        // Mock issue comments response
        gitHubApiMock.fetchIssueComments.mockResolvedValueOnce([
            {
                created_at: '2023-09-21T12:00:00Z',
            },
        ]);

        const score = await responsivenessCalculator.ComputeResponsiveness();

        expect(score).toBeGreaterThan(0); // Expect score to be calculated correctly
        expect(gitHubApiMock.fetchIssues).toHaveBeenCalledTimes(1); // Issues API called once
        expect(gitHubApiMock.fetchIssueComments).toHaveBeenCalledTimes(1); // Comments API called once
    });

    it('should return max score if no comments or closed issues are present', async () => {
        // Mock GitHub issues response with an open issue without comments
        gitHubApiMock.fetchIssues.mockResolvedValueOnce([
            {
                number: 2,
                title: 'Issue 2',
                created_at: '2023-09-20T12:00:00Z',
                closed_at: null,
                comments_url:
                    'https://api.github.com/repos/owner/repo/issues/2/comments',
            },
        ]);

        // Mock comments response with no comments
        gitHubApiMock.fetchIssueComments.mockResolvedValueOnce([]);

        const score = await responsivenessCalculator.ComputeResponsiveness();

        expect(score).toBe(1); // Expect max score if no responsiveness data is available
    });

    it('should calculate responsiveness when multiple issues are present', async () => {
        // Mock multiple GitHub issues response
        gitHubApiMock.fetchIssues.mockResolvedValueOnce([
            {
                number: 3,
                title: 'Issue 3',
                created_at: '2023-09-20T12:00:00Z',
                closed_at: '2023-09-22T12:00:00Z',
                comments_url:
                    'https://api.github.com/repos/owner/repo/issues/3/comments',
            },
            {
                number: 4,
                title: 'Issue 4',
                created_at: '2023-09-21T12:00:00Z',
                closed_at: '2023-09-23T12:00:00Z',
                comments_url:
                    'https://api.github.com/repos/owner/repo/issues/4/comments',
            },
        ]);

        // Mock comments responses for both issues
        gitHubApiMock.fetchIssueComments
            .mockResolvedValueOnce([
                {
                    created_at: '2023-09-21T12:00:00Z',
                },
            ])
            .mockResolvedValueOnce([
                {
                    created_at: '2023-09-22T12:00:00Z',
                },
            ]);

        const score = await responsivenessCalculator.ComputeResponsiveness();

        expect(score).toBeLessThan(1); // Expect a valid responsiveness score
        expect(gitHubApiMock.fetchIssues).toHaveBeenCalledTimes(1); // Issues API called once
        expect(gitHubApiMock.fetchIssueComments).toHaveBeenCalledTimes(2); // Comments API called twice
    });

    it('should handle errors in API requests gracefully', async () => {
        // Mock a failed GitHub API call
        gitHubApiMock.fetchIssues.mockRejectedValueOnce(new Error('API error'));

        try {
            await responsivenessCalculator.ComputeResponsiveness();
        } catch (error) {
            expect(error).toBeDefined();
        }

        expect(gitHubApiMock.fetchIssues).toHaveBeenCalled();
    });
});
