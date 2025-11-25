# Claude Code Configuration

This directory contains Claude Code configuration files and hooks for the duyetbot-agent project.

## Hooks

### Session Start Hook (`hooks/session-start.sh`)

Automatically runs when a new Claude Code session starts:

1. **Dependency Installation**: Runs `npm install` if `node_modules/` doesn't exist
2. **Git Hooks Setup**: Runs `npm run prepare-hooks` to install git hooks

This ensures the development environment is ready immediately when you start working.

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

### PLAN.md Auto-Update Hook (LLM-based)

An intelligent Stop hook that automatically maintains PLAN.md after each Claude Code session.

**How it works:**

1. **Triggers**: Runs when Claude finishes responding (Stop event)
2. **Analyzes**: Uses LLM to review the conversation transcript
3. **Decides**: Determines if substantive progress was made on plan items
4. **Updates**: If warranted, marks completed tasks and updates revision history

**What gets updated:**

- Completed tasks marked with `[x]`
- New discovered tasks added to appropriate phases
- Revision History table updated with date and summary

**When it updates:**

- ✅ Completing tasks listed in PLAN.md
- ✅ Implementing features or phases
- ✅ Fixing bugs tracked in the plan
- ✅ Making architectural decisions

**When it skips:**

- ❌ Simple questions or explanations
- ❌ Reading files without changes
- ❌ Failed/incomplete attempts
- ❌ Work unrelated to the project plan

**Configuration**: Defined as a `Stop` hook with `type: prompt` in `settings.json`.

## Settings

The `settings.json` file configures Claude Code hooks:

- **sessionStart**: Runs setup script on session start
- **bash.post hook**: Triggers after bash commands matching `^git push`
- **Stop hook**: LLM-based PLAN.md maintenance after each response

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
