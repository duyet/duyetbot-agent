# CI/Local Parity Guide

## Problem: Local Works, CI Fails

A common issue in monorepos: code builds successfully locally but fails in GitHub Actions CI.

**Root Cause**: Bun workspace hoisting masks missing dependencies.

## How Workspace Hoisting Works

### Local Development

When you install dependencies locally with Bun in a monorepo:

```bash
bun install
```

Bun creates a flattened `node_modules` structure at the root:

```
project/
├── node_modules/
│   ├── @duyetbot/
│   │   ├── types/          ← Available to ALL packages
│   │   ├── tools/          ← Even if not explicitly declared
│   │   ├── chat-agent/
│   │   └── ...
│   └── ...
├── packages/
│   └── github-bot/
│       ├── src/
│       │   └── middlewares/mention.ts
│       └── package.json    ← Doesn't declare @duyetbot/types
└── ...
```

This allows `apps/github-bot/src/middlewares/mention.ts` to import:

```typescript
import { extractTask } from '@duyetbot/types/mention-parser';
```

Even though `apps/github-bot/package.json` doesn't declare `@duyetbot/types` as a dependency.

### CI Environment (GitHub Actions)

CI with a fresh checkout:

```bash
bun install  # Only installs dependencies from package.json
```

Creates per-package `node_modules`:

```
project/
├── packages/github-bot/
│   ├── node_modules/
│   │   ├── @duyetbot/chat-agent/
│   │   ├── @duyetbot/hono-middleware/
│   │   └── ... (only declared dependencies)
│   └── package.json        ← Missing @duyetbot/types!
└── ...
```

Now the import fails:

```
error TS2307: Cannot find module '@duyetbot/types/mention-parser'
```

## Solution: Explicit Dependency Declaration

### Before (Missing Dependency)

`apps/github-bot/package.json`:

```json
{
  "dependencies": {
    "@duyetbot/chat-agent": "workspace:*",
    "@duyetbot/hono-middleware": "workspace:*",
    "@duyetbot/observability": "workspace:*",
    "@duyetbot/prompts": "workspace:*",
    "@duyetbot/providers": "workspace:*",
    "@duyetbot/tools": "workspace:*",
    "@octokit/rest": "^21.0.0"
  }
}
```

### After (Explicit Declaration)

```json
{
  "dependencies": {
    "@duyetbot/chat-agent": "workspace:*",
    "@duyetbot/hono-middleware": "workspace:*",
    "@duyetbot/observability": "workspace:*",
    "@duyetbot/prompts": "workspace:*",
    "@duyetbot/providers": "workspace:*",
    "@duyetbot/tools": "workspace:*",
    "@duyetbot/types": "workspace:*",  // ← Added explicit declaration
    "@octokit/rest": "^21.0.0"
  }
}
```

## Reproducing CI Environment Locally

To catch these issues before pushing to CI:

### Option 1: Clean Install Test

```bash
# Remove local workspace hoisting
rm -rf node_modules

# Fresh install (respects package.json declarations)
bun install

# Build should fail if dependencies are missing
bun run build
```

### Option 2: Use Pre-Push Hook

The local pre-push hook now includes a build check:

```bash
git commit -m "feat: add new import"
git push  # Runs: lint → type-check → build → test
```

If `build` fails due to missing dependencies, the push is blocked.

### Option 3: Dependency Checker Script

Run the automated dependency validation:

```bash
bun run scripts/check-deps.ts
```

Example output with missing dependency:

```
🔍 Checking dependencies in all packages and apps...

❌ Found 1 missing dependencies:

📦 @duyetbot/github-bot:
   apps/github-bot/src/middlewares/mention.ts - Missing dependency: "@duyetbot/types" (imported as "@duyetbot/types/mention-parser")

⚠️  Fix these issues by adding missing dependencies to package.json
```

## Prevention Checklist

When adding new imports:

- [ ] Import is from `@duyetbot/*` package
- [ ] Target package is listed in `package.json` dependencies
- [ ] Run `bun run scripts/check-deps.ts` to validate
- [ ] Run `bun run build` locally before pushing
- [ ] Pre-push hook will catch issues before CI (includes build step)

## Common Patterns

### Adding a New Workspace Dependency

1. **Create the import**:
   ```typescript
   import { something } from '@duyetbot/new-package';
   ```

2. **Add to dependencies**:
   ```bash
   # Edit package.json
   "@duyetbot/new-package": "workspace:*"
   ```

3. **Verify with clean install**:
   ```bash
   rm -rf node_modules && bun install && bun run build
   ```

### Checking For Missing Dependencies

```bash
# Before committing
bun run scripts/check-deps.ts

# Before pushing
bun run build
```

## Why This Matters

**Workspace hoisting is convenient during development** but creates hidden dependencies that only manifest in CI. Explicit declarations:

- ✅ Make dependencies explicit and discoverable
- ✅ Ensure CI builds match local builds
- ✅ Allow other developers to understand package structure
- ✅ Prevent merge conflicts from CI failures

## References

- [Bun Workspace Documentation](https://bun.sh/docs/install/workspaces)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [Pre-push Hook](/Users/duet/project/duyetbot-agent/.git/hooks/pre-push) - Now includes build check
