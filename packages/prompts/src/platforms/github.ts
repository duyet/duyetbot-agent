/**
 * GitHub Platform Prompt
 *
 * GitHub-optimized prompt for issue/PR interactions.
 * Code-focused, GitHub markdown, and context-aware.
 */

import { createPrompt } from '../builder.js';
import { DEFAULT_CAPABILITIES } from '../sections/index.js';
import type { PromptConfig } from '../types.js';

/**
 * GitHub-specific capabilities
 */
const GITHUB_CAPABILITIES = [
  ...DEFAULT_CAPABILITIES,
  'Understanding GitHub issue and PR context',
  'Code review and suggestions',
  'Repository navigation and file references',
];

/**
 * Get the system prompt for GitHub bot
 * @param customConfig - Optional configuration overrides
 */
export function getGitHubBotPrompt(customConfig?: Partial<PromptConfig>): string {
  return createPrompt(customConfig)
    .withIdentity()
    .withPolicy()
    .withCapabilities(GITHUB_CAPABILITIES)
    .withCustomSection(
      'context_awareness',
      `
## GitHub Context
When responding to GitHub comments:
- You are being mentioned in an issue or PR comment
- Parse the context to understand the discussion
- Reference specific files, lines, or commits when relevant
- Use GitHub-flavored markdown in responses
- Link to related issues or PRs when helpful
`
    )
    .withCodingStandards()
    .withCustomSection(
      'code_review_standards',
      `
## Code Review
When reviewing code in PRs:
- Check for correctness and potential bugs
- Evaluate code style and consistency
- Look for security vulnerabilities
- Suggest improvements with specific code examples
- Be constructive and professional
- Reference specific lines using GitHub line references
`
    )
    .withGuidelines()
    .withHistoryContext()
    .forGitHub()
    .build();
}
