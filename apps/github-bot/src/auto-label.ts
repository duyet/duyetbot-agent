/**
 * Auto-labeling for GitHub Issues and PRs
 *
 * Provides rule-based labeling functionality for issues and pull requests.
 * Labels are applied based on content analysis without requiring AI.
 */

import { Octokit } from '@octokit/rest';
import { logger } from './logger.js';

/** Available labels for the repository */
const REPOSITORY_LABELS = [
  'bug',
  'enhancement',
  'documentation',
  'question',
  'good first issue',
  'help wanted',
  'priority: high',
  'priority: medium',
  'priority: low',
  'dependencies',
  'performance',
  'security',
  'tests',
  'typescript',
  'infrastructure',
] as const;

/** Label derived from content analysis */
type RepositoryLabel = (typeof REPOSITORY_LABELS)[number];

/**
 * Label configuration with patterns
 */
interface LabelRule {
  label: RepositoryLabel;
  keywords: string[];
  titlePatterns?: RegExp[];
  excludeKeywords?: string[];
}

/** Label rules for automatic classification */
const LABEL_RULES: LabelRule[] = [
  {
    label: 'bug',
    keywords: [
      'bug',
      'fix',
      'broken',
      'crash',
      'error',
      'issue',
      'fail',
      "doesn't work",
      'not working',
    ],
    titlePatterns: [/^fix(es|ed)?/i, /^bug:?/i],
  },
  {
    label: 'enhancement',
    keywords: ['feature', 'enhancement', 'improve', 'add', 'new', 'implement', 'support for'],
    titlePatterns: [/^feat|hance/i, /^(add|implement)/i],
  },
  {
    label: 'documentation',
    keywords: ['doc', 'readme', 'comment', 'documentation', 'guide', 'tutorial'],
    titlePatterns: [/^doc(s|umentation)?:/i, /^readme/i],
  },
  {
    label: 'question',
    keywords: ['question', 'how', 'what', 'why', 'help', 'clarif', 'confused', 'understand'],
    titlePatterns: [/^question:?/i],
  },
  {
    label: 'security',
    keywords: ['security', 'vulnerability', 'exploit', 'xss', 'injection', 'csrf', 'auth'],
  },
  {
    label: 'performance',
    keywords: ['slow', 'performance', 'optimize', 'latency', 'speed', 'fast', 'memory'],
  },
  {
    label: 'tests',
    keywords: ['test', 'spec', 'coverage', 'testing', 'unit test', 'integration'],
  },
  {
    label: 'typescript',
    keywords: ['typescript', 'ts', 'typing', 'type definition', 'generics'],
  },
  {
    label: 'infrastructure',
    keywords: ['ci', 'cd', 'deploy', 'pipeline', 'workflow', 'github actions', 'docker'],
  },
  {
    label: 'dependencies',
    keywords: ['depend', 'upgrade', 'version', 'package', 'npm', 'bun', 'library'],
  },
];

/** Priority label rules */
const PRIORITY_RULES: LabelRule[] = [
  {
    label: 'priority: high',
    keywords: ['urgent', 'critical', 'blocking', 'severe', 'major', 'important', 'asap'],
    titlePatterns: [/^\[high\]|^\[urgent\]/i],
  },
  {
    label: 'priority: medium',
    keywords: ['medium', 'normal', 'moderate'],
    titlePatterns: [/^\[medium\]/i],
  },
  {
    label: 'priority: low',
    keywords: ['low', 'minor', 'nice to have', 'eventually', 'later'],
    titlePatterns: [/^\[low\]/i],
  },
];

/** Good first issue indicators (must be explicitly mentioned or very simple fix) */
const GOOD_FIRST_INDICATORS = [
  'good first issue',
  'beginner',
  'starter',
  'simple fix',
  'easy fix',
  'small fix',
  'typo',
  'misspell',
  'documentation',
];

/**
 * Analyze issue/PR content and suggest labels
 *
 * @param title - Issue or PR title
 * @param body - Issue or PR body (optional)
 * @returns Array of suggested labels
 */
export function suggestLabels(title: string, body?: string): string[] {
  const content = `${title} ${body || ''}`.toLowerCase();
  const suggested: Set<RepositoryLabel> = new Set();

  // Apply category label rules (only one category label)
  for (const rule of LABEL_RULES) {
    // Check if excluded by any rule
    if (rule.excludeKeywords?.some((kw) => content.includes(kw))) {
      continue;
    }

    // Check title patterns
    if (rule.titlePatterns?.some((pattern) => pattern.test(title))) {
      suggested.add(rule.label);
      continue;
    }

    // Check keywords
    if (rule.keywords.some((kw) => content.includes(kw))) {
      suggested.add(rule.label);
    }
  }

  // Apply priority rules (only one priority label)
  for (const rule of PRIORITY_RULES) {
    if (rule.titlePatterns?.some((pattern) => pattern.test(title))) {
      suggested.add(rule.label);
      break; // Only apply first matching priority
    }
    if (rule.keywords.some((kw) => content.includes(kw))) {
      suggested.add(rule.label);
      break; // Only apply first matching priority
    }
  }

  // Check for "good first issue" indicators
  if (GOOD_FIRST_INDICATORS.some((kw) => content.includes(kw))) {
    suggested.add('good first issue');
  }

  // If no labels found yet, add a default (but not if we already have specific labels)
  if (suggested.size === 0) {
    suggested.add('help wanted');
  }

  return Array.from(suggested);
}

/**
 * Apply labels to an issue or PR via GitHub API
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue or PR number
 * @param labels - Labels to apply
 * @returns True if labels were applied successfully
 */
export async function applyLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[]
): Promise<boolean> {
  try {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });

    logger.info('[AUTO_LABEL] Labels applied', {
      repository: `${owner}/${repo}`,
      issueNumber,
      labels,
    });

    return true;
  } catch (error) {
    logger.error('[AUTO_LABEL] Failed to apply labels', {
      repository: `${owner}/${repo}`,
      issueNumber,
      labels,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Auto-label an issue or PR
 *
 * Analyzes the title and body, suggests labels, and applies them via GitHub API.
 *
 * @param githubToken - GitHub authentication token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue or PR number
 * @param title - Issue or PR title
 * @param body - Issue or PR body (optional)
 * @returns True if labeling was successful
 */
export async function autoLabel(
  githubToken: string,
  owner: string,
  repo: string,
  issueNumber: number,
  title: string,
  body?: string
): Promise<boolean> {
  const octokit = new Octokit({ auth: githubToken });

  // Suggest labels based on content
  const suggestedLabels = suggestLabels(title, body);

  if (suggestedLabels.length === 0) {
    logger.debug('[AUTO_LABEL] No labels suggested', {
      repository: `${owner}/${repo}`,
      issueNumber,
      title: title.substring(0, 50),
    });
    return false;
  }

  // Apply labels
  return await applyLabels(octokit, owner, repo, issueNumber, suggestedLabels);
}
