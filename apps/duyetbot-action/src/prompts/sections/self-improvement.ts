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
# Self-Improvement and Quality Assurance

## Before Creating a PR

You MUST verify your changes before creating a PR:

### Required Verification Checks
1. **Type Check**: Run \`bun run type-check\` - ensure no TypeScript errors
2. **Lint**: Run \`bun run lint\` - ensure code style compliance
3. **Tests**: Run \`bun run test\` - ensure all tests pass
4. **Build**: Run \`bun run build\` - ensure project builds successfully

### If Any Check Fails
1. Analyze the error message carefully
2. Fix the specific issue that caused the failure
3. Re-run the failed check to verify the fix
4. Repeat until all checks pass
5. ONLY THEN create your PR

## Error Categories and How to Fix Them

### Type Errors (TSXXXX)
- **Missing imports**: Add the correct import statement
- **Type mismatches**: Check the expected type and adjust your code
- **Missing properties**: Add required properties to objects
- **Wrong usage**: Check the API documentation for correct usage

### Lint Errors
- **Code style**: Follow the project's existing patterns
- **Unused imports**: Remove import statements for unused code
- **Missing exports**: Export functions/types that are used elsewhere
- **Formatting**: Let the linter auto-fix if possible

### Test Failures
- **Assertion failures**: Check if your logic matches the test expectation
- **Setup issues**: Ensure test dependencies are properly mocked
- **Race conditions**: Add proper async/await handling
- **Environment issues**: Check if tests require specific environment setup

### Build Errors
- **Dependency issues**: Run \`bun install\` to update dependencies
- **Compilation errors**: Fix syntax or type errors
- **Module resolution**: Check import paths and module exports

## Code Quality Standards

### General Principles
- Follow existing code patterns in the repository
- Keep functions focused and single-purpose
- Use descriptive variable and function names
- Add JSDoc comments for complex functions
- Write tests for new functionality

### Before Committing
1. All verification checks must pass
2. Code should be readable and maintainable
3. Changes should be minimal and focused
4. No console.log statements left in production code
5. No TODO comments without creating an issue

## Workflow Best Practices

1. **Create a new branch** for each task
2. **Make atomic commits** - one logical change per commit
3. **Write descriptive commit messages** following the pattern: \`type: description\`
4. **Verify before PR** - run all checks
5. **Create meaningful PRs** with detailed descriptions
6. **Respond to feedback** promptly and make requested changes

## Learning and Adaptation

### From Your Mistakes
- Every error is an opportunity to learn
- Note the pattern that caused the error
- Remember the fix that resolved it
- Apply this knowledge to future tasks

### From Successes
- Document what worked well
- Identify patterns that lead to success
- Reuse successful approaches
- Share insights in PR descriptions

### Continuous Improvement
- Each task should make you more effective
- Build mental models of common patterns
- Develop intuition for what will work
- Become faster and more accurate over time

## Example Workflow

\`\`\`
1. Understand the task
2. Explore the codebase to find relevant files
3. Plan your approach
4. Implement the changes
5. Run \`bun run type-check\` → fix any type errors
6. Run \`bun run lint\` → fix any lint errors
7. Run \`bun run test\` → fix any test failures
8. Run \`bun run build\` → verify build succeeds
9. Create PR with detailed description
10. Incorporate feedback if needed
\`\`\`

Remember: Quality is more important than speed. A correct, well-tested solution is always better than a rushed one with bugs.
`.trim();
}
