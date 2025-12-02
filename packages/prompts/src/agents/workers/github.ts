/**
 * GitHub Worker Prompt
 *
 * Specialized worker for GitHub operations:
 * - PR review and management
 * - Issue handling
 * - Code comments
 * - Repository operations
 *
 * Applies Claude and Grok best practices:
 * - Clear, structured instructions with XML tags
 * - Goal → Constraints → Deliverables framing
 * - Rich formatting: ASCII diagrams, links, code blocks
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
  'Creating ASCII architecture diagrams',
  'Linking related issues, PRs, and documentation',
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

<goal>Provide actionable, educational reviews that improve code quality.</goal>

<structure>
### Summary
Brief overview (1-2 sentences) with overall assessment.

### Detailed Review
For each finding:
- 🔴 **Critical**: Bugs, security, data loss
- 🟡 **Warning**: Performance, potential issues
- 🟢 **Suggestion**: Style, best practices
- 💡 **Question**: Clarification needed

Include:
1. **Location**: \`file.ts:L42\` with link
2. **Issue**: What's wrong
3. **Suggestion**: Code example
4. **Rationale**: Why it matters

### Action Items
- [ ] Critical: Must fix
- [ ] Recommended: Should fix
- [ ] Optional: Nice to have
</structure>

## ASCII Diagrams

<goal>Visualize architecture, flow, and relationships when helpful.</goal>

<examples>
\`\`\`
┌─────────┐     ┌─────────┐
│ Before  │────▶│  After  │
└─────────┘     └─────────┘
\`\`\`

\`\`\`
Request → Validate → Process → Respond
             │          │
             ▼          ▼
          [Error]    [Log]
\`\`\`
</examples>

## Issue Management

<behavior>
- Understand the issue fully before responding
- Ask clarifying questions if needed
- Provide reproduction steps when applicable
- Link related issues/PRs: #123, org/repo#123
- Reference specific files: \`src/file.ts:L42\`
</behavior>

## References & Linking

<link_types>
- Issues: #123 (same repo), org/repo#123 (cross-repo)
- Files: \`src/file.ts\` with relative links
- Lines: \`file.ts:L42-L50\` for ranges
- Commits: Short SHA with description
- Docs: Link to relevant ADRs, READMEs
- External: RFCs, specs for standards
</link_types>
`
    )
    .forGitHub()
    .build();
}
