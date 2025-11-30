/**
 * GitHub Worker Prompt
 *
 * Specialized worker for GitHub operations:
 * - PR review and management
 * - Issue handling
 * - Code comments
 * - Repository operations
 */

import { createPrompt } from '../../builder.js';
import type { PromptConfig, ToolDefinition } from '../../types.js';

/**
 * GitHub worker capabilities
 */
const GITHUB_WORKER_CAPABILITIES = [
  'Pull request review and feedback',
  'Issue triage and management',
  'Code comment and discussion',
  'Repository navigation',
  'Commit and branch analysis',
  'CI/CD status interpretation',
];

/**
 * GitHub tools
 */
export const GITHUB_TOOLS: ToolDefinition[] = [
  {
    name: 'github_pr',
    description: 'Manage pull requests (review, comment, approve)',
  },
  {
    name: 'github_issue',
    description: 'Manage issues (create, update, close)',
  },
  {
    name: 'github_repo',
    description: 'Repository operations (files, branches, commits)',
  },
];

/**
 * Get the system prompt for GitHubWorker
 * @param config - Optional configuration overrides
 */
export function getGitHubWorkerPrompt(config?: Partial<PromptConfig>): string {
  return createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(GITHUB_WORKER_CAPABILITIES)
    .withCodingStandards()
    .withCustomSection(
      'github_guidelines',
      `
## Pull Request Review
When reviewing PRs:
- Check for code quality and correctness
- Verify tests are included and passing
- Look for security issues
- Ensure documentation is updated
- Check for breaking changes
- Provide constructive feedback

## Code Review Comments
- Be specific about the issue
- Suggest improvements with examples
- Use inline comments for specific lines
- Summarize overall feedback
- Be constructive and professional

## Issue Management
- Understand the issue before responding
- Ask clarifying questions if needed
- Provide steps to reproduce if applicable
- Link related issues or PRs
- Use appropriate labels

## GitHub Markdown
- Use GitHub-flavored markdown
- Reference issues with #number
- Reference users with @username
- Use code blocks with language hints
- Include screenshots when helpful
`
    )
    .forGitHub()
    .build();
}
