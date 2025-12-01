/**
 * GitHub API Helper Module
 *
 * Provides helper functions for fetching additional context from GitHub API
 * including comments history and PR diffs for context enrichment.
 */

import { Octokit } from '@octokit/rest';
import { logger } from './logger.js';

/** Maximum characters for diff snippets to prevent token explosion */
const MAX_DIFF_LENGTH = 3000;

/** Default number of comments to fetch */
const DEFAULT_COMMENT_LIMIT = 5;

/**
 * Options for fetching recent comments
 */
export interface FetchCommentsOptions {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Issue or PR number */
  issueNumber: number;
  /** Maximum number of comments to fetch (default: 5) */
  limit?: number | undefined;
}

/**
 * Options for fetching PR diff
 */
export interface FetchDiffOptions {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Pull request number */
  pullNumber: number;
}

/**
 * Format a date to a short, readable string
 * @param dateStr - ISO date string
 * @returns Formatted date like "2024-01-15"
 */
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Fetch recent comments from an issue or PR
 *
 * Retrieves the last N comments and formats them for context injection.
 * Comments are formatted as:
 * ```
 * [@username at 2024-01-15]: Comment text...
 * ```
 *
 * @param octokit - Authenticated Octokit instance
 * @param options - Fetch options
 * @returns Formatted comments string, or empty string on error
 *
 * @example
 * ```typescript
 * const octokit = new Octokit({ auth: token });
 * const comments = await fetchRecentComments(octokit, {
 *   owner: 'duyet',
 *   repo: 'duyetbot-agent',
 *   issueNumber: 123,
 *   limit: 5,
 * });
 * ```
 */
export async function fetchRecentComments(
  octokit: Octokit,
  options: FetchCommentsOptions
): Promise<string> {
  const { owner, repo, issueNumber, limit = DEFAULT_COMMENT_LIMIT } = options;

  try {
    // Fetch comments, sorted by created_at ascending (oldest first)
    // We get more than needed and slice to get the most recent
    const response = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100, // Get more to ensure we have enough after filtering
      sort: 'created',
      direction: 'asc',
    });

    if (!response.data.length) {
      return '';
    }

    // Get the last N comments
    const recentComments = response.data.slice(-limit);

    // Format each comment
    const formatted = recentComments.map((comment) => {
      const username = comment.user?.login ?? 'unknown';
      const date = formatDate(comment.created_at);
      const body = truncateText(comment.body ?? '', 500); // Limit each comment to 500 chars
      return `[@${username} at ${date}]: ${body}`;
    });

    logger.debug('[GITHUB-API] Fetched comments', {
      owner,
      repo,
      issueNumber,
      totalComments: response.data.length,
      returnedComments: recentComments.length,
    });

    return formatted.join('\n\n');
  } catch (error) {
    logger.error('[GITHUB-API] Failed to fetch comments', {
      owner,
      repo,
      issueNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}

/**
 * Fetch PR diff and format for context injection
 *
 * Retrieves the diff for a pull request, truncated to MAX_DIFF_LENGTH
 * to prevent token explosion. Includes file headers for navigation.
 *
 * @param octokit - Authenticated Octokit instance
 * @param options - Fetch options
 * @returns Formatted diff string, or empty string on error
 *
 * @example
 * ```typescript
 * const octokit = new Octokit({ auth: token });
 * const diff = await fetchPRDiff(octokit, {
 *   owner: 'duyet',
 *   repo: 'duyetbot-agent',
 *   pullNumber: 123,
 * });
 * ```
 */
export async function fetchPRDiff(octokit: Octokit, options: FetchDiffOptions): Promise<string> {
  const { owner, repo, pullNumber } = options;

  try {
    // Fetch the diff using the media type for diff format
    const response = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
      mediaType: {
        format: 'diff',
      },
    });

    // The response.data will be a string when using diff format
    const diff = response.data as unknown as string;

    if (!diff || typeof diff !== 'string') {
      logger.debug('[GITHUB-API] No diff available', {
        owner,
        repo,
        pullNumber,
      });
      return '';
    }

    // Truncate if too long
    const truncatedDiff = truncateText(diff, MAX_DIFF_LENGTH);
    const wasTruncated = diff.length > MAX_DIFF_LENGTH;

    logger.debug('[GITHUB-API] Fetched PR diff', {
      owner,
      repo,
      pullNumber,
      originalLength: diff.length,
      truncated: wasTruncated,
    });

    if (wasTruncated) {
      return `${truncatedDiff}\n\n[Diff truncated - showing first ${MAX_DIFF_LENGTH} characters of ${diff.length} total]`;
    }

    return truncatedDiff;
  } catch (error) {
    logger.error('[GITHUB-API] Failed to fetch PR diff', {
      owner,
      repo,
      pullNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}

/**
 * Fetch both comments and diff for a PR in parallel
 *
 * Convenience function to fetch all context enrichment data in one call.
 *
 * @param octokit - Authenticated Octokit instance
 * @param options - Combined options
 * @returns Object with commentsThread and diffSnippets
 */
export async function fetchPRContext(
  octokit: Octokit,
  options: {
    owner: string;
    repo: string;
    pullNumber: number;
    commentLimit?: number;
  }
): Promise<{ commentsThread: string; diffSnippets: string }> {
  const { owner, repo, pullNumber, commentLimit } = options;

  const [commentsThread, diffSnippets] = await Promise.all([
    fetchRecentComments(octokit, {
      owner,
      repo,
      issueNumber: pullNumber,
      limit: commentLimit,
    }),
    fetchPRDiff(octokit, { owner, repo, pullNumber }),
  ]);

  return { commentsThread, diffSnippets };
}

/**
 * Fetch comments for an issue (non-PR)
 *
 * Convenience function for issues that don't need diff fetching.
 *
 * @param octokit - Authenticated Octokit instance
 * @param options - Fetch options
 * @returns Object with commentsThread only
 */
export async function fetchIssueContext(
  octokit: Octokit,
  options: {
    owner: string;
    repo: string;
    issueNumber: number;
    commentLimit?: number;
  }
): Promise<{ commentsThread: string }> {
  const { owner, repo, issueNumber, commentLimit } = options;

  const commentsThread = await fetchRecentComments(octokit, {
    owner,
    repo,
    issueNumber,
    limit: commentLimit,
  });

  return { commentsThread };
}
