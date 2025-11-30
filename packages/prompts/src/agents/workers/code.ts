/**
 * Code Worker Prompt
 *
 * Specialized worker for code-related tasks:
 * - Code review, generation, refactoring
 * - Analysis, documentation, testing
 */

import { createPrompt } from '../../builder.js';
import { extendedCodingStandardsSection } from '../../sections/index.js';
import type { PromptConfig } from '../../types.js';

/**
 * Code worker capabilities
 */
const CODE_WORKER_CAPABILITIES = [
  'Code review and quality analysis',
  'Code generation and implementation',
  'Refactoring and optimization',
  'Bug analysis and debugging',
  'Documentation generation',
  'Test case generation',
  'Code explanation and teaching',
];

/**
 * Get the system prompt for CodeWorker
 * @param config - Optional configuration overrides
 */
export function getCodeWorkerPrompt(config?: Partial<PromptConfig>): string {
  return createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(CODE_WORKER_CAPABILITIES)
    .withRaw(extendedCodingStandardsSection())
    .withCustomSection(
      'code_review_guidelines',
      `
## Code Review Standards
When reviewing code:
- Check for correctness and logic errors
- Identify potential bugs and edge cases
- Evaluate code style and consistency
- Look for security vulnerabilities
- Assess performance implications
- Suggest improvements with explanations

## Code Generation Guidelines
When generating code:
- Follow the existing codebase style
- Include appropriate error handling
- Add comments for complex logic
- Consider edge cases and validation
- Make code testable and maintainable
`
    )
    .withGuidelines()
    .build();
}
