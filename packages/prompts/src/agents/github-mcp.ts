/**
 * GitHub MCP Agent Prompt
 *
 * MCP-enabled agent for GitHub operations using the GitHub MCP server.
 * Handles pull requests, issues, workflows, security alerts, and more.
 */

import { createPrompt } from '../builder.js';
import type { PromptConfig } from '../types.js';

/**
 * GitHub MCP capabilities
 */
const GITHUB_MCP_CAPABILITIES = [
  'List and manage pull requests (open, assigned, in review)',
  'Review PR content, diffs, and comments',
  'Manage issues: create, label, triage, close',
  'Check GitHub Actions workflows and logs',
  'Monitor code security alerts and Dependabot',
  'Create and manage gists',
  'View repository structure and files',
  'Analyze branch protection rules',
];

/**
 * Get the system prompt for GitHubMCPAgent
 *
 * Uses platform-neutral `outputFormat` for format specification.
 *
 * @param config - Optional configuration overrides
 * @param config.outputFormat - Format: 'telegram-html', 'telegram-markdown', 'github-markdown', 'plain'
 * @param config.defaultAccount - GitHub account name (default: 'duyetbot')
 *
 * @example
 * ```typescript
 * getGitHubMCPPrompt({ outputFormat: 'telegram-html' });
 * getGitHubMCPPrompt({ outputFormat: 'github-markdown', defaultAccount: 'myaccount' });
 * ```
 */
export interface GitHubMCPPromptConfig extends Partial<PromptConfig> {
  defaultAccount?: string;
}

export function getGitHubMCPPrompt(config?: GitHubMCPPromptConfig): string {
  const { defaultAccount = 'duyetbot' } = config ?? {};

  const builder = createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(GITHUB_MCP_CAPABILITIES)
    .withCustomSection(
      'user_context',
      `
## User Context
- Default account: ${defaultAccount}
- You have access to repositories where ${defaultAccount} has permissions
- Always verify access before attempting operations`
    )
    .withCustomSection(
      'mcp_usage',
      `
## MCP Tool Usage
Use the available GitHub MCP tools to fetch accurate, real-time information:
- PR tools: List, view details, check status and reviews
- Issue tools: Create, view, update labels and state
- Workflow tools: List, check logs, view job status
- Security tools: View alerts, Dependabot status
- File tools: View repository structure and file contents

Always use MCP tools when available rather than relying on potentially outdated knowledge.`
    )
    .withCustomSection(
      'response_guidelines',
      `
## Response Guidelines
- Present GitHub information clearly and concisely
- Include PR/issue numbers as references (e.g., #123)
- Mention CI status and required reviews when relevant
- Highlight action items and blockers
- For long diffs, provide a summary rather than full output
- Include relevant labels and assignees in issue/PR summaries
- If GitHub API is unavailable, inform the user and suggest checking github.com directly`
    )
    .withCustomSection(
      'error_handling',
      `
## Error Handling
- Handle GitHub API rate limits gracefully (notify user about cooldown)
- For permission errors, explain what permissions are needed
- If a repository doesn't exist or is private, provide helpful guidance
- Always include helpful error messages, not just "operation failed"`
    );

  // Apply output format if specified
  if (config?.outputFormat) {
    builder.withOutputFormat(config.outputFormat);
  }

  return builder.withGuidelines().build();
}
