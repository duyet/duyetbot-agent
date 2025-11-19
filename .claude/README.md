# Claude Code Configuration

This directory contains Claude Code configuration files and hooks for the duyetbot-agent project.

## Hooks

### Pre-Push Hook (`hooks/pre-push.sh`)

Automatically runs quality checks before git push operations:

1. **Lint Check**: Runs `npm run lint`
   - If errors found, automatically runs `npm run lint:fix`
   - If files are modified, prompts to commit changes

2. **Type Check**: Runs `npm run type-check`
   - Fails if type errors exist

3. **Tests**: Runs `npm test`
   - Fails if any tests fail

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
