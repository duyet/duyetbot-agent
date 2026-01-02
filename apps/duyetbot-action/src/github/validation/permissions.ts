/**
 * Permission Validation
 *
 * Checks if the actor has write permissions to the repository
 */

import type { Octokit } from '../api/client.js';
import type { GitHubContext } from '../context.js';

/**
 * Checks if the actor has write permissions
 */
export async function checkWritePermissions(
  octokit: Octokit,
  context: GitHubContext,
  allowedNonWriteUsers: string,
  githubTokenProvided: boolean
): Promise<boolean> {
  const { owner, repo } = context.repository;

  // If github_token was provided, allowedNonWriteUsers bypasses permission check
  if (githubTokenProvided && allowedNonWriteUsers) {
    if (allowedNonWriteUsers === '*') {
      console.log('⚠️  All users allowed (allowed_non_write_users: *)');
      return true;
    }

    const allowedUsers = allowedNonWriteUsers.split(',').map((u) => u.trim().toLowerCase());
    if (allowedUsers.includes(context.actor.toLowerCase())) {
      console.log(`✓ User ${context.actor} is in allowed_non_write_users list`);
      return true;
    }
  }

  try {
    // Check permission level
    const response = await octokit.rest.repos.get({
      owner,
      repo,
    });

    // @ts-expect-error - permissions property exists but not in types
    const permissions = response.data.permissions;

    if (permissions?.push || permissions?.admin || permissions?.maintain) {
      return true;
    }

    console.log('Permission check result:', permissions);
    return false;
  } catch (error) {
    console.error('Failed to check permissions:', error);
    return false;
  }
}
