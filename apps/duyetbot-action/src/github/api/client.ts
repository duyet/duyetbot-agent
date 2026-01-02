/**
 * GitHub API Client
 *
 * Wrapper around Octokit for GitHub API operations
 */

import { Octokit } from 'octokit';

export type { Octokit };

/**
 * Creates an authenticated Octokit instance
 */
export function createOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
  });
}
