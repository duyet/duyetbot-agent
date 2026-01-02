/**
 * Tag Operations
 *
 * GitHub API operations for repository tags and releases.
 */

import type { Octokit } from '../api/client.js';

export interface CreateTagOptions {
  owner: string;
  repo: string;
  tagName: string;
  target: string; // commit SHA
  message?: string;
  type?: 'commit' | 'tree' | 'blob';
  title?: string; // for release
  body?: string; // for release
  draft?: boolean; // for release
  prerelease?: boolean; // for release
}

export interface TagResult {
  tagName: string;
  sha: string;
  url: string;
}

/**
 * Create a new git tag object
 */
export async function createTag(octokit: Octokit, options: CreateTagOptions): Promise<TagResult> {
  const { owner, repo, tagName, target, message, type } = options;

  // Create the tag object
  const tagResponse = await octokit.rest.git.createTag({
    owner,
    repo,
    tag: tagName,
    object: target,
    message: message || `Tag ${tagName}`,
    type: type || 'commit',
    tagging: JSON.stringify({ name: 'duyetbot', email: 'duyetbot@users.noreply.github.com' }),
  });

  // Create a reference to the tag
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/tags/${tagName}`,
    sha: tagResponse.data.sha,
  });

  return {
    tagName,
    sha: tagResponse.data.sha,
    url: tagResponse.data.url,
  };
}

/**
 * Create a new release (which also creates a tag)
 */
export async function createRelease(
  octokit: Octokit,
  options: CreateTagOptions
): Promise<{ tagName: string; htmlUrl: string; uploadUrl: string }> {
  const { owner, repo, tagName, target, title, body, draft, prerelease } = options;

  // First create the tag if it doesn't exist
  try {
    await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `tags/${tagName}`,
    });
  } catch {
    // Tag doesn't exist, create it
    await createTag(octokit, {
      owner,
      repo,
      tagName,
      target,
      message: `Release ${tagName}`,
    });
  }

  // Create the release
  const response = await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tagName,
    target_commitish: target,
    name: title || tagName,
    body: body || '',
    draft: draft || false,
    prerelease: prerelease || false,
  });

  return {
    tagName,
    htmlUrl: response.data.html_url,
    uploadUrl: response.data.upload_url,
  };
}

/**
 * Get tag details
 */
export async function getTag(
  octokit: Octokit,
  owner: string,
  repo: string,
  tagName: string
): Promise<{
  tagName: string;
  sha: string;
  message: string;
  url: string;
}> {
  const response = await octokit.rest.git.getTag({
    owner,
    repo,
    tag_sha: tagName,
  });

  return {
    tagName,
    sha: response.data.sha,
    message: response.data.message || '',
    url: response.data.url,
  };
}

/**
 * List tags in a repository
 */
export async function listTags(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<Array<{ tagName: string; sha: string; url: string }>> {
  const response = await octokit.rest.git.listMatchingRefs({
    owner,
    repo,
    ref: 'tags',
  });

  return response.data
    .filter((ref) => ref.ref.startsWith('refs/tags/'))
    .map((ref) => ({
      tagName: ref.ref.replace('refs/tags/', ''),
      sha: ref.object.sha,
      url: ref.object.url,
    }));
}

/**
 * Delete a tag
 */
export async function deleteTag(
  octokit: Octokit,
  owner: string,
  repo: string,
  tagName: string
): Promise<void> {
  // Delete the reference
  await octokit.rest.git.deleteRef({
    owner,
    repo,
    ref: `tags/${tagName}`,
  });
}

/**
 * Get a release by tag name
 */
export async function getReleaseByTag(
  octokit: Octokit,
  owner: string,
  repo: string,
  tagName: string
): Promise<{
  id: number;
  tagName: string;
  htmlUrl: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
} | null> {
  try {
    const response = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag: tagName,
    });

    return {
      id: response.data.id,
      tagName: response.data.tag_name,
      htmlUrl: response.data.html_url,
      body: response.data.body || '',
      draft: response.data.draft,
      prerelease: response.data.prerelease,
    };
  } catch {
    return null;
  }
}

/**
 * List releases
 */
export async function listReleases(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<
  Array<{
    id: number;
    tagName: string;
    name: string;
    htmlUrl: string;
    draft: boolean;
    prerelease: boolean;
    createdAt: string;
  }>
> {
  const response = await octokit.rest.repos.listReleases({
    owner,
    repo,
  });

  return response.data.map((release) => ({
    id: release.id,
    tagName: release.tag_name,
    name: release.name || '',
    htmlUrl: release.html_url,
    draft: release.draft,
    prerelease: release.prerelease,
    createdAt: release.created_at,
  }));
}

/**
 * Update a release
 */
export async function updateRelease(
  octokit: Octokit,
  owner: string,
  repo: string,
  releaseId: number,
  updates: {
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
  }
): Promise<void> {
  await octokit.rest.repos.updateRelease({
    owner,
    repo,
    release_id: releaseId,
    ...updates,
  });
}

/**
 * Delete a release
 */
export async function deleteRelease(
  octokit: Octokit,
  owner: string,
  repo: string,
  releaseId: number
): Promise<void> {
  await octokit.rest.repos.deleteRelease({
    owner,
    repo,
    release_id: releaseId,
  });
}
