/**
 * Branch Operations
 *
 * GitHub API operations for repository branches.
 */

import type { Octokit } from '../api/client.js';

export interface CreateBranchOptions {
  owner: string;
  repo: string;
  branchName: string;
  fromBranch?: string;
  sha?: string;
}

export interface BranchResult {
  name: string;
  sha: string;
  url: string;
}

/**
 * Create a new branch
 */
export async function createBranch(
  octokit: Octokit,
  options: CreateBranchOptions
): Promise<BranchResult> {
  const { owner, repo, branchName, fromBranch, sha } = options;

  // Get the SHA of the base branch if not provided
  let baseSha = sha;
  if (!baseSha) {
    const baseRef = fromBranch || 'main';
    const refResponse = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseRef}`,
    });
    baseSha = refResponse.data.object.sha;
  }

  // Create the new branch reference
  const response = await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  return {
    name: branchName,
    sha: response.data.object.sha,
    url: response.data.object.url,
  };
}

/**
 * Delete a branch
 */
export async function deleteBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string
): Promise<void> {
  await octokit.rest.git.deleteRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
  });
}

/**
 * Get branch details
 */
export async function getBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string
): Promise<{
  name: string;
  sha: string;
  protected: boolean;
  url: string;
}> {
  const response = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: branchName,
  });

  return {
    name: response.data.name,
    sha: response.data.commit.sha,
    protected: response.data.protected,
    url: response.data.commit.url,
  };
}

/**
 * List branches in a repository
 */
export async function listBranches(
  octokit: Octokit,
  owner: string,
  repo: string,
  protectedOnly?: boolean
): Promise<Array<{ name: string; sha: string; protected: boolean }>> {
  const params: Record<string, unknown> = {
    owner,
    repo,
  };
  if (protectedOnly !== undefined) {
    params.protected = protectedOnly;
  }

  const response = await octokit.rest.repos.listBranches(params as any);

  return response.data.map((branch) => ({
    name: branch.name,
    sha: branch.commit.sha,
    protected: branch.protected || false,
  }));
}

/**
 * Check if a branch exists
 */
export async function branchExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string
): Promise<boolean> {
  try {
    await getBranch(octokit, owner, repo, branchName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the default branch of a repository
 */
export async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> {
  const response = await octokit.rest.repos.get({
    owner,
    repo,
  });
  return response.data.default_branch;
}

/**
 * Compare two branches/refs
 */
export async function compareBranches(
  octokit: Octokit,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<{
  aheadBy: number;
  behindBy: number;
  diverged: boolean;
  filesChanged: number;
}> {
  const response = await octokit.rest.repos.compareCommits({
    owner,
    repo,
    base,
    head,
  });

  return {
    aheadBy: response.data.ahead_by,
    behindBy: response.data.behind_by,
    diverged: response.data.status === 'diverged',
    filesChanged: response.data.files?.length || 0,
  };
}

/**
 * Merge a branch into another
 */
export async function mergeBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  base: string,
  head: string,
  commitMessage?: string
): Promise<{ merged: boolean; sha: string }> {
  const params: Record<string, unknown> = {
    owner,
    repo,
    base,
    head,
  };
  if (commitMessage !== undefined) {
    params.commit_message = commitMessage;
  }

  const response = await octokit.rest.repos.merge(params as any);

  return {
    merged: true,
    sha: response.data.sha,
  };
}
