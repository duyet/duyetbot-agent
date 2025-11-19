# Claude Code Configuration

This directory contains Claude Code configuration files and hooks for the duyetbot-agent project.

## Hooks

### Pre-Push Hook (`hooks/pre-push.sh`)

Automatically runs quality checks before git push operations with auto-fix and retry:

1. **Lint Check**: Runs `npm run lint`
   - If errors found, automatically runs `npm run lint:fix`
   - If files are modified, automatically amends the commit
   - Push retries automatically with fixed code

2. **Type Check**: Runs `npm run type-check` (non-blocking)
   - Shows warnings but doesn't block the push
   - Helps catch potential type issues

3. **Tests**: Runs `npm test`
   - Blocks push if any tests fail
   - Claude will analyze failures, fix them, and commit
   - Retry the push to trigger checks again

### Auto-Fix Workflow

```
git push
  ↓
Hook runs lint check
  ↓
Lint errors found? → Auto-fix → Amend commit → Retry push automatically ✓
  ↓
Tests fail? → Exit → Claude fixes → Commit → Retry push manually ✓
  ↓
All checks pass? → Push succeeds ✓
```

**Configuration**: The hook is registered in `settings.json` to trigger on `git push` commands.

### Manual Execution

You can manually run the pre-push checks:

```bash
./.claude/hooks/pre-push.sh
```

## Settings

The `settings.json` file configures Claude Code hooks:

- **bash.post hook**: Triggers after bash commands matching `^git push`
- **blocking**: true - Prevents push if checks fail
- **command**: Runs the pre-push.sh script

## Alternative: Git Hooks

For stronger enforcement, you can also use native git hooks. Run:

```bash
npm run prepare-hooks
```

This will install the git hooks into `.git/hooks/` directory.

## Disabling Hooks

If you need to bypass the hook temporarily:

```bash
git push --no-verify
```

**Note**: Only use `--no-verify` when absolutely necessary, as it bypasses important quality checks.
