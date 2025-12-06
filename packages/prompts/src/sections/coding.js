/**
 * Coding Standards Section
 *
 * Best practices for code generation and review.
 */
/**
 * Generate the coding standards section
 */
export function codingStandardsSection() {
  return `<coding_standards>
- Follow best practices and conventions for the language/framework
- Include comments for complex logic
- Handle errors appropriately
- Prefer TypeScript when applicable
- Write clean, readable code with meaningful names
- Follow SOLID principles for object-oriented code
- Keep functions small and focused on a single task
- Write testable code with clear inputs and outputs
</coding_standards>`;
}
/**
 * Extended coding standards for code-focused agents
 */
export function extendedCodingStandardsSection() {
  return `<coding_standards>
## Code Quality
- Follow best practices and conventions for the language/framework
- Include comments for complex logic, but prefer self-documenting code
- Handle errors appropriately with meaningful messages
- Prefer TypeScript when applicable for type safety

## Design Principles
- Follow SOLID principles for object-oriented code
- Keep functions small and focused (single responsibility)
- Prefer composition over inheritance
- Use dependency injection for testability

## Code Style
- Write clean, readable code with meaningful names
- Consistent formatting and indentation
- Group related functionality together
- Avoid magic numbers and strings - use constants

## Testing
- Write testable code with clear inputs and outputs
- Consider edge cases and error conditions
- Keep tests focused and independent
- Use descriptive test names

## Security
- Validate all user inputs
- Avoid hardcoding secrets or credentials
- Use parameterized queries for database operations
- Follow the principle of least privilege
</coding_standards>`;
}
