# Contributing

**Related:** [Getting Started](GETTING_STARTED.md) | [Architecture](ARCHITECTURE.md) | [API Reference](API.md)

Thank you for your interest in contributing to duyetbot-agent!

---

## Code of Conduct

Be respectful and constructive. We welcome contributors of all skill levels.

---

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/duyetbot-agent.git
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Workflow

### 1. Read PLAN.md

Before starting work, read [PLAN.md](../PLAN.md) to understand:
- Current phase and priorities
- Dependencies between tasks
- What has been completed

### 2. Make Changes

- Write clear, documented code
- Follow existing patterns
- Add tests for new functionality

### 3. Test Your Changes

```bash
# Run all tests
pnpm test

# Run linting
pnpm run lint

# Run type checking
pnpm run type-check
```

### 4. Commit

Use semantic commit messages:

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in session manager"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for auth"
git commit -m "refactor: simplify provider logic"
```

**Format**: `<type>: <description in lowercase>`

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Commit Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `test` | Adding tests |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `chore` | Maintenance |
| `ci` | CI/CD changes |
| `build` | Build system |

---

## Code Style

### TypeScript

- Use strict TypeScript (no `any` without justification)
- Export types from `@duyetbot/types` package
- Use Zod for runtime validation

### Formatting

- Use Biome for linting and formatting
- Run `pnpm run format` before committing

### Testing

- Write tests for all new code
- Use Vitest for testing
- Follow existing test patterns
- Aim for high coverage

### Documentation

- Document public APIs with JSDoc
- Update README/docs for user-facing changes
- Include examples in documentation

---

## Project Structure

When adding new features:

```
packages/
├── core/          # Agent core - session, MCP client
├── providers/     # LLM adapters - add new providers here
├── tools/         # Agent tools - add new tools here
├── server/        # HTTP API - add new routes here
├── cli/           # CLI commands - add new commands here
├── memory-mcp/    # MCP server - session storage
└── types/         # Shared types - add new types here

apps/
└── github-bot/    # GitHub webhook handler
```

---

## Adding a New Tool

1. Create tool in `packages/tools/src/`:
   ```typescript
   import { tool } from '@anthropic/claude-sdk';
   import { z } from 'zod';

   export const myTool = tool(
     'my_tool',
     'Description of what it does',
     z.object({
       input: z.string().describe('Input parameter'),
     }),
     async ({ input }) => {
       // Implementation
       return { result: 'output' };
     }
   );
   ```

2. Register in `packages/tools/src/registry.ts`
3. Add tests in `packages/tools/src/__tests__/`
4. Export from `packages/tools/src/index.ts`

---

## Adding a New LLM Provider

1. Create adapter in `packages/providers/src/`:
   ```typescript
   import { LLMProvider } from '@duyetbot/types';

   export class MyProvider implements LLMProvider {
     async *query(messages, options) {
       // Implementation
     }
   }
   ```

2. Register in `packages/providers/src/factory.ts`
3. Add tests
4. Update documentation

---

## Pull Request Guidelines

### Title

Use semantic format: `feat: add new feature`

### Description

- Describe what changed and why
- Link to related issues
- Include testing instructions

### Checklist

- [ ] Tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm run lint`)
- [ ] Types check (`pnpm run type-check`)
- [ ] Documentation updated if needed
- [ ] PLAN.md updated if completing tasks

---

## Reporting Issues

### Bug Reports

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (Node version, OS)
- Error messages/logs

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternatives considered

---

## Questions?

- Open a [GitHub Discussion](https://github.com/duyet/duyetbot-agent/discussions)
- Check existing issues for similar questions
- Read the [Architecture](ARCHITECTURE.md) docs

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
