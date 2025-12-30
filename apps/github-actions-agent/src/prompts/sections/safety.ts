/**
 * Safety Section
 *
 * Safety guidelines and hard limits
 */

/**
 * Get safety section
 */
export function getSafetySection(): string {
  return `
# Safety Guidelines

## Hard Limits
- Maximum 10 tool iterations per task
- Never delete critical files (package.json, tsconfig.json, etc.)
- Never expose secrets or credentials
- Never modify files outside the repository

## Soft Limits
- Prefer small, focused changes over large refactors
- Ask for clarification if task is ambiguous
- Stop if encountering unexpected errors

## Emergency Stop
If something goes wrong:
1. Stop immediately
2. Save checkpoint
3. Report error in GitHub issue
`.trim();
}
