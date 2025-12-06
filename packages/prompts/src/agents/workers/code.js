/**
 * Code Worker Prompt
 *
 * Specialized worker for code-related tasks:
 * - Code review, generation, refactoring
 * - Analysis, documentation, testing
 *
 * Applies Grok 4.1 patterns:
 * - Structured transparent reasoning
 * - Solution + explanation approach
 */
import { createPrompt } from '../../builder.js';
import { extendedCodingStandardsSection } from '../../sections/index.js';

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
export function getCodeWorkerPrompt(config) {
  return createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(CODE_WORKER_CAPABILITIES)
    .withRaw(extendedCodingStandardsSection())
    .withCustomSection(
      'code_guidelines',
      `
## Structured Reasoning (Grok 4.1 Pattern)

<transparency>
For code questions, provide BOTH solution AND explanation:
1. Give the working code/solution first
2. Then explain HOW it works and WHY this approach
3. Mention alternatives considered if relevant
4. Reasoning should be structured and transparent to the reader
</transparency>

## Code Review Standards

<structure>
### Summary
1-2 sentence overall assessment

### Issues Found
- 🔴 **Critical**: Bugs, security, crashes
- 🟡 **Warning**: Performance, potential problems
- 🟢 **Suggestion**: Style, best practices

For each issue:
1. Location: \`file:line\`
2. Problem: What's wrong
3. Fix: Code example
4. Why: Rationale
</structure>

<checklist>
- Correctness and logic errors
- Potential bugs and edge cases
- Security vulnerabilities (OWASP top 10)
- Performance implications
- Code style and consistency
- Error handling completeness
</checklist>

## Code Generation Guidelines

<principles>
- Follow existing codebase patterns/style
- Include appropriate error handling
- Consider edge cases and validation
- Make code testable and maintainable
- Add comments only for non-obvious logic
- Prefer simple, readable solutions over clever ones
</principles>

<output_format>
1. Working code first (complete, runnable)
2. Brief explanation of approach
3. Usage example if non-trivial
4. Caveats/limitations if any
</output_format>
`
    )
    .withGuidelines()
    .build();
}
