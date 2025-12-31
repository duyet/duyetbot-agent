# Contributing to DuyetBot Web

Thank you for your interest in contributing! This guide will help you get started.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/duyet/duyetbot-agent.git
cd duyetbot-agent
bun install

# 2. Set up environment
cd apps/web
cp .env.example .env.local
# Edit .env.local with your API keys

# 3. Start development
bun dev
```

## Development Workflow

### Branch Naming

```
feature/description    # New features
fix/description       # Bug fixes
docs/description      # Documentation
refactor/description  # Code refactoring
test/description      # Test additions
```

### Commit Messages

Follow semantic commit format:

```bash
feat: add new feature
fix: resolve bug
docs: update documentation
test: add tests
refactor: improve code structure
perf: optimize performance
chore: maintenance tasks
```

Scope is optional but recommended:

```bash
feat(web): add dark mode toggle
fix(auth): resolve session expiry issue
docs(api): update endpoint documentation
```

### Pre-Commit Checks

Before committing, ensure:

```bash
bun run check        # Lint and type-check
bun run test         # Run all tests
```

The pre-push hook enforces these automatically.

## Project Structure

```
apps/web/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes (login, register)
│   └── (chat)/            # Chat routes
├── components/            # React components
│   ├── ui/               # Base UI components (shadcn)
│   └── *.tsx             # Feature components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and shared logic
│   ├── ai/               # AI/LLM related
│   ├── auth/             # Authentication
│   ├── db/               # Database (Drizzle + D1)
│   └── *.ts              # Utilities
├── worker/               # Cloudflare Worker (Hono)
│   ├── routes/           # API route handlers
│   └── lib/              # Worker utilities
├── artifacts/            # Artifact type renderers
├── tests/                # Test suites
│   ├── e2e/              # Playwright E2E tests
│   ├── api/              # API integration tests
│   └── manual/           # Manual test scripts
└── docs/                 # Documentation
```

## Key Technologies

| Technology | Purpose | Documentation |
|------------|---------|---------------|
| Next.js 15 | Frontend framework | [nextjs.org](https://nextjs.org) |
| Hono | API framework | [hono.dev](https://hono.dev) |
| Drizzle ORM | Database access | [orm.drizzle.team](https://orm.drizzle.team) |
| AI SDK | LLM integration | [sdk.vercel.ai](https://sdk.vercel.ai) |
| Playwright | E2E testing | [playwright.dev](https://playwright.dev) |
| Vitest | Unit testing | [vitest.dev](https://vitest.dev) |

## Adding Features

### 1. New API Endpoint

Create a new route in `worker/routes/`:

```typescript
// worker/routes/my-feature.ts
import { Hono } from "hono";
import type { HonoEnv } from "../types";

const myFeatureRoutes = new Hono<HonoEnv>();

myFeatureRoutes.get("/", async (c) => {
  // Implementation
  return c.json({ data: "..." });
});

export { myFeatureRoutes };
```

Register in `worker/index.ts`:

```typescript
import { myFeatureRoutes } from "./routes/my-feature";
app.route("/api/my-feature", myFeatureRoutes);
```

Update OpenAPI spec in `worker/openapi.ts`.

### 2. New Component

Create component in `components/`:

```typescript
// components/my-component.tsx
"use client";

import { useState } from "react";

interface MyComponentProps {
  // Props
}

export function MyComponent({ ...props }: MyComponentProps) {
  // Implementation
  return <div>...</div>;
}
```

### 3. New Tool

Add tool in `worker/lib/tools.ts`:

```typescript
export const myTool: Tool = {
  description: "What this tool does",
  parameters: z.object({
    input: z.string().describe("Input description"),
  }),
  execute: async ({ input }) => {
    // Implementation
    return { result: "..." };
  },
};
```

Register in the tools export.

### 4. Database Changes

1. Update schema in `lib/db/schema.ts`
2. Generate migration:
   ```bash
   bun run db:generate
   ```
3. Review generated SQL in `lib/db/migrations/`
4. Apply locally:
   ```bash
   bun run db:migrate
   ```
5. Apply to production:
   ```bash
   wrangler d1 migrations apply duyetbot --remote
   ```

## Testing

### Unit Tests

```bash
bun run test:unit              # Run unit tests
bun run test:unit --watch      # Watch mode
```

Write tests alongside source files:

```
lib/utils.ts
lib/utils.test.ts
```

### API Tests

```bash
bun run test:api               # Run API tests
```

Tests in `tests/api/`:

```typescript
import { describe, it, expect } from "vitest";

describe("My API", () => {
  it("should return data", async () => {
    const response = await fetch("/api/my-endpoint");
    expect(response.ok).toBe(true);
  });
});
```

### E2E Tests

```bash
bun run test                   # Local E2E tests
bun run test:production        # Production E2E tests
```

Use Page Object Model pattern:

```typescript
// tests/pages/my-page.ts
import type { Page } from "@playwright/test";

export class MyPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto("/my-page");
  }

  async doAction() {
    await this.page.click('[data-testid="action"]');
  }
}
```

### Test Data Attributes

Use `data-testid` for test selectors:

```tsx
<button data-testid="send-message">Send</button>
```

## Code Style

### TypeScript

- Use strict mode
- Prefer interfaces over types for objects
- Use explicit return types for functions
- Avoid `any` - use `unknown` if needed

### React

- Use functional components with hooks
- Prefer server components when possible
- Use `"use client"` directive only when needed
- Extract reusable logic to custom hooks

### CSS

- Use Tailwind CSS utilities
- Follow mobile-first responsive design
- Use CSS variables for theming
- Avoid inline styles

### Naming Conventions

```
Components: PascalCase (MyComponent.tsx)
Hooks: camelCase with use prefix (useMyHook.ts)
Utils: camelCase (myUtil.ts)
Constants: SCREAMING_SNAKE_CASE
Types/Interfaces: PascalCase
```

## Pull Request Process

1. Create feature branch from `main`
2. Make changes following guidelines above
3. Ensure all checks pass:
   ```bash
   bun run check && bun run test
   ```
4. Push and create PR
5. Fill in PR template with:
   - Summary of changes
   - Test plan
   - Screenshots (for UI changes)
6. Address review feedback
7. Merge when approved

### PR Checklist

- [ ] Code follows project conventions
- [ ] Tests added for new functionality
- [ ] Documentation updated if needed
- [ ] No console errors or warnings
- [ ] Responsive design verified
- [ ] Accessibility considered

## Getting Help

- **API Docs**: `/api/docs` (Swagger UI)
- **Architecture**: `docs/ARCHITECTURE.md`
- **Deployment**: `docs/DEPLOYMENT.md`
- **Issues**: [GitHub Issues](https://github.com/duyet/duyetbot-agent/issues)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
