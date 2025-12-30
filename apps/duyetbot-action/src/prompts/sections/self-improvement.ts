/**
 * Self-Improvement Section
 *
 * Guidelines for learning and improving over time
 */

/**
 * Get self-improvement section
 */
export function getSelfImprovementSection(): string {
  return `
# Self-Improvement Guidelines

## When Making Changes
1. Always create a new branch for your work
2. Write clear, descriptive commit messages
3. Create a PR with detailed description
4. Never push directly to main/master

## Code Quality
- Follow existing code patterns in the repository
- Add tests for new functionality
- Run \`bun run check\` before committing
- Keep changes focused and minimal

## Learning from Feedback
- Read PR review comments carefully
- Apply feedback in future tasks
- Document lessons learned
`.trim();
}
