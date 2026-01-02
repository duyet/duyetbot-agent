/**
 * Commit Operations
 *
 * Git commit operations for local repository changes.
 * These operations work directly with git on the filesystem.
 */

import { $ } from 'execa';

export interface CommitOptions {
  message: string;
  author?: {
    name: string;
    email: string;
  };
  coAuthors?: string[];
  allowEmpty?: boolean;
  amend?: boolean;
}

export interface CommitResult {
  sha: string;
  shortSha: string;
  message: string;
}

/**
 * Stage files for commit
 */
export async function stageFiles(files: string[]): Promise<void> {
  if (files.length === 0) return;

  await $`git add ${files}`;
}

/**
 * Stage all changes
 */
export async function stageAll(): Promise<void> {
  await $`git add -A`;
}

/**
 * Create a commit
 */
export async function createCommit(options: CommitOptions): Promise<CommitResult> {
  const { message, author, coAuthors, allowEmpty, amend } = options;

  // Build commit command
  const commitArgs = ['commit', '-m', message];

  if (author) {
    commitArgs.push('--author', `${author.name} <${author.email}>`);
  }

  if (coAuthors && coAuthors.length > 0) {
    // Add co-authors to commit message
    const coAuthorTrailers = coAuthors.map((coAuthor) => `Co-Authored-By: ${coAuthor}`);
    commitArgs.push('-m', coAuthorTrailers.join('\n'));
  }

  if (allowEmpty) {
    commitArgs.push('--allow-empty');
  }

  if (amend) {
    commitArgs.push('--amend');
  }

  // Execute commit
  await $`git ${commitArgs}`;

  // Get commit info
  const sha = await getCommitSHA('HEAD');
  const { stdout: shortSha } = await $`git rev-parse --short HEAD`;

  return {
    sha,
    shortSha: shortSha.trim(),
    message: message.split('\n')[0] ?? '', // First line only
  };
}

/**
 * Get commit SHA for a ref
 */
export async function getCommitSHA(ref: string): Promise<string> {
  const { stdout } = await $`git rev-parse ${ref}`;
  return stdout.trim();
}

/**
 * Get commit details
 */
export async function getCommit(sha: string): Promise<{
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorDate: string;
  committer: string;
  committerDate: string;
  parents: string[];
}> {
  const [formatResult, authorResult, committerResult] = await Promise.all([
    $`git log -1 --format=%H,%h,%s,%P ${sha}`,
    $`git log -1 --format=%an <%ae>%n%aI ${sha}`,
    $`git log -1 --format=%cn <%ce>%n%cI ${sha}`,
  ]);

  const [fullSha, shortSha, subject, parents] = formatResult.stdout.split(',');
  const [author, authorDate] = authorResult.stdout.trim().split('\n');
  const [committer, committerDate] = committerResult.stdout.trim().split('\n');

  return {
    sha: fullSha ?? '',
    shortSha: shortSha ?? '',
    message: subject ?? '',
    author: author ?? '',
    authorDate: authorDate ?? '',
    committer: committer ?? '',
    committerDate: committerDate ?? '',
    parents: parents ? parents.split(' ') : [],
  };
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const { stdout } = await $`git rev-parse --abbrev-ref HEAD`;
  return stdout.trim();
}

/**
 * Get the current HEAD SHA
 */
export async function getHeadSHA(): Promise<string> {
  return getCommitSHA('HEAD');
}

/**
 * Check if there are staged changes
 */
export async function hasStagedChanges(): Promise<boolean> {
  try {
    const { stdout } = await $`git diff --cached --name-only`;
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if there are unstaged changes
 */
export async function hasUnstagedChanges(): Promise<boolean> {
  try {
    const { stdout } = await $`git diff --name-only`;
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if there are untracked files
 */
export async function hasUntrackedFiles(): Promise<boolean> {
  try {
    const { stdout } = await $`git ls-files --others --exclude-standard`;
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if working directory is clean
 */
export async function isWorkingDirectoryClean(): Promise<boolean> {
  return (
    !(await hasStagedChanges()) && !(await hasUnstagedChanges()) && !(await hasUntrackedFiles())
  );
}

/**
 * Get changed files between two refs
 */
export async function getChangedFiles(
  from: string,
  to: string
): Promise<
  Array<{
    path: string;
    status: 'A' | 'D' | 'M' | 'R' | 'C';
    additions: number;
    deletions: number;
  }>
> {
  const { stdout } = await $`git diff --numstat ${from}...${to}`;

  return stdout
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [additions, deletions, path] = line.split('\t');
      if (!path) {
        throw new Error('Invalid git diff output: missing path');
      }
      return {
        path,
        status: 'M', // Simplified - full parsing would require --name-status
        additions: parseInt(additions ?? '0', 10) || 0,
        deletions: parseInt(deletions ?? '0', 10) || 0,
      };
    });
}

/**
 * Configure git user for commits
 */
export async function configureGitUser(name: string, email: string): Promise<void> {
  await Promise.all([$`git config user.name ${name}`, $`git config user.email ${email}`]);
}

/**
 * Configure GPG signing for commits
 */
export async function configureGpgSigning(enabled: boolean, keyId?: string): Promise<void> {
  if (enabled) {
    await $`git config commit.gpgsign true`;
    if (keyId) {
      await $`git config user.signingkey ${keyId}`;
    }
  } else {
    await $`git config commit.gpgsign false`;
  }
}

/**
 * Amend the last commit
 */
export async function amendCommit(
  options: Partial<CommitOptions> & { message?: string }
): Promise<CommitResult> {
  return createCommit({ ...options, amend: true, message: options.message ?? '' });
}

/**
 * Cherry-pick a commit
 */
export async function cherryPick(sha: string): Promise<void> {
  await $`git cherry-pick ${sha}`;
}

/**
 * Revert a commit
 */
export async function revertCommit(sha: string): Promise<CommitResult> {
  await $`git revert ${sha} --no-edit`;

  const newSha = await getCommitSHA('HEAD');
  const { stdout: shortSha } = await $`git rev-parse --short HEAD`;

  return {
    sha: newSha,
    shortSha: shortSha.trim(),
    message: `Revert commit ${sha.slice(0, 7)}`,
  };
}

/**
 * Get commit history
 */
export async function getCommitHistory(
  ref: string = 'HEAD',
  limit: number = 10
): Promise<
  Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
  }>
> {
  const { stdout } = await $`git log -${limit} --format=%H%n%h%n%s%n%an%n%aI ${ref}`;

  const commits: Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
  }> = [];

  const lines = stdout.trim().split('\n');
  for (let i = 0; i < lines.length; i += 5) {
    commits.push({
      sha: lines[i] ?? '',
      shortSha: lines[i + 1] ?? '',
      message: lines[i + 2] ?? '',
      author: lines[i + 3] ?? '',
      date: lines[i + 4] ?? '',
    });
  }

  return commits;
}
