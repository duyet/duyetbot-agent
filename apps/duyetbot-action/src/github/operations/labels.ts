/**
 * Label Operations
 *
 * GitHub API operations for issue/PR labels.
 */

import type { Octokit } from '../api/client.js';

/**
 * Add labels to an issue or PR
 */
export async function addLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[]
): Promise<void> {
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });
}

/**
 * Remove a specific label from an issue or PR
 */
export async function removeLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labelName: string
): Promise<void> {
  await octokit.rest.issues.removeLabel({
    owner,
    repo,
    issue_number: issueNumber,
    name: labelName,
  });
}

/**
 * Replace all labels on an issue or PR
 */
export async function setLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[]
): Promise<void> {
  await octokit.rest.issues.setLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });
}

/**
 * List labels on an issue or PR
 */
export async function listLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<Array<{ name: string; color: string; description: string }>> {
  const response = await octokit.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return response.data.map((label) => ({
    name: label.name,
    color: label.color,
    description: label.description || '',
  }));
}

/**
 * Check if an issue/PR has a specific label
 */
export async function hasLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labelName: string
): Promise<boolean> {
  const labels = await listLabels(octokit, owner, repo, issueNumber);
  return labels.some((l) => l.name.toLowerCase() === labelName.toLowerCase());
}
