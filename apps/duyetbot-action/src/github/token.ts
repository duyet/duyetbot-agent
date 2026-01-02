/**
 * GitHub Token Setup
 *
 * Handles GitHub token configuration from various sources:
 * 1. User-provided token via github_token input
 * 2. GitHub App token (from GITHUB_TOKEN)
 * 3. Environment variables
 */

/**
 * Sets up the GitHub token from available sources
 *
 * Priority order:
 * 1. OVERRIDE_GITHUB_TOKEN (from github_token input)
 * 2. GITHUB_TOKEN (default workflow token)
 * 3. GITHUB_TOKEN env var
 */
export async function setupGitHubToken(): Promise<string> {
  // Check for override token (from github_token input)
  const overrideToken = process.env.OVERRIDE_GITHUB_TOKEN;
  if (overrideToken) {
    console.log('Using provided github_token input');
    return overrideToken;
  }

  // Check for default workflow token
  const defaultToken = process.env.GITHUB_TOKEN;
  if (defaultToken) {
    console.log('Using default GITHUB_TOKEN');
    return defaultToken;
  }

  // For now, we require a token
  // In the future, this could try to use a GitHub App
  throw new Error(
    'GitHub token not found. Provide it via github_token input or ensure GITHUB_TOKEN is available.'
  );
}
