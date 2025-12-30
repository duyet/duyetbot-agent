# Continuous Mode - Fully Autonomous Task Processing

## Overview

Continuous mode enables `duyetbot-action` to process **all available tasks** autonomously without human intervention. The agent will:

1. Pick the highest priority task from the queue
2. Implement the solution
3. Verify and create PR
4. Auto-merge after CI checks pass
5. Close the issue
6. **Move to the next task automatically**
7. Repeat until no more tasks

## What It Does

### The Autonomous Loop

```
┌─────────────────────────────────────────────────────────────┐
│                     Continuous Mode                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Pick next task from queue (GitHub issues, TASKS.md)     │
│     │                                                        │
│     ▼                                                        │
│  2. Analyze and implement solution                          │
│     │                                                        │
│     ▼                                                        │
│  3. Verify: type-check → lint → test → build                │
│     │                                                        │
│     ▼                                                        │
│  4. Create PR with detailed description                     │
│     │                                                        │
│     ▼                                                        │
│  5. Wait for CI checks (if configured)                      │
│     │                                                        │
│     ▼                                                        │
│  6. Approve and merge PR                                    │
│     │                                                        │
│     ▼                                                        │
│  7. Close issue                                             │
│     │                                                        │
│     ▼                                                        │
│  8. Delete feature branch                                   │
│     │                                                        │
│     ▼                                                        │
│  9. Wait brief delay (default: 5s)                          │
│     │                                                        │
│     └─► Go back to step 1 (pick next task)                  │
│                                                              │
│    Stops when:                                              │
│    - No more tasks available                                │
│    - Max tasks limit reached                                │
│    - Task failed (if stopOnFirstFailure enabled)            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Features

1. **Non-Stop Processing**: Automatically picks up the next task after completing current one
2. **Configurable Limits**: Set max tasks to process per session
3. **Delay Between Tasks**: Optional pause to avoid overwhelming systems
4. **Auto-Close Issues**: Automatically closes issues after successful PR merge
5. **Stop on Failure**: Option to stop immediately if a task fails
6. **Progress Tracking**: Shows task number and cumulative statistics

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CONTINUOUS_MODE` | Enable continuous mode | `false` |
| `CONTINUOUS_MAX_TASKS` | Maximum tasks to process per session | `100` |
| `CONTINUOUS_DELAY_MS` | Delay between tasks (milliseconds) | `5000` (5s) |
| `CLOSE_ISSUES_AFTER_MERGE` | Close issues after PR merge | `true` |
| `STOP_ON_FIRST_FAILURE` | Stop if a task fails | `false` |

### Config Object

```typescript
{
  continuous: {
    enabled: true,
    maxTasks: 100,
    delayBetweenTasks: 5000,
    closeIssuesAfterMerge: true,
    stopOnFirstFailure: false
  },
  autoMerge: {
    enabled: true,
    requireChecks: ['ci'],
    waitForChecks: true,
    timeout: 600000,
    approveFirst: true,
    deleteBranch: true,
    closeIssueAfterMerge: true
  }
}
```

## Usage

### Command Line

```bash
# Enable continuous mode via CLI flag
bun run apps/duyetbot-action/src/index.ts --continuous

# With specific task source
bun run apps/duyetbot-action/src/index.ts --continuous --source github-issues

# Start from a specific task, then continue with others
bun run apps/duyetbot-action/src/index.ts --continuous --task github-123
```

### Environment Variables

```bash
export CONTINUOUS_MODE=true
export CONTINUOUS_MAX_TASKS=50
export CONTINUOUS_DELAY_MS=10000
export CLOSE_ISSUES_AFTER_MERGE=true

bun run apps/duyetbot-action/src/index.ts
```

### GitHub Actions Workflow

```yaml
name: Autonomous Agent

on:
  workflow_dispatch:
    inputs:
      max_tasks:
        description: 'Maximum tasks to process'
        required: false
        default: '100'

jobs:
  autonomous:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run autonomous agent
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CONTINUOUS_MODE: "true"
          CONTINUOUS_MAX_TASKS: ${{ github.event.inputs.max_tasks || '100' }}
          AUTO_MERGE: "true"
          CLOSE_ISSUES_AFTER_MERGE: "true"
        run: |
          bun run apps/duyetbot-action/src/index.ts --continuous
```

## Output Example

```
🤖 GitHub Actions Agent starting...
🔄 Continuous mode enabled - will process all tasks
📌 Active sources: github-issues, file

🔄 Continuous mode started
   Max tasks: 100
   Stop on first failure: No
   Delay between tasks: 5000ms

============================================================
🎯 Task 1: Add user authentication
   Source: github-issues | Priority: high | ID: github-123
============================================================

🔄 Running agent loop...
   [Step 1] Analyzing requirements...
   [Step 2] Planning implementation...
   [Step 3] Implementing auth service...
   [Step 4] Adding tests...
   [Step 5] Running verification...

✅ Verification passed

📤 Reporting results...
🔄 Auto-merging PR #45...
⏳ Waiting for CI checks...
✅ All 2 required checks passed
✅ PR approved
✅ PR merged
✅ Issue #123 closed

✅ Task 1 completed successfully

📊 Task Summary:
   Duration: 45.23s
   Tokens: 125000
   Steps: 5

⏳ Waiting 5000ms before next task...

============================================================
🎯 Task 2: Fix navigation bug
   Source: github-issues | Priority: medium | ID: github-124
============================================================

... (continues until no more tasks)

📭 No more tasks available

============================================================
📊 Continuous Mode Summary
============================================================
   Tasks completed: 15
   Total tokens used: 1,875,000
   Total task time: 678.45s
   Total session time: 753.45s
   Avg tokens per task: 125,000
   Avg time per task: 45.23s
============================================================
```

## Safety Features

### Limits and Controls

1. **Max Tasks Limit**: Prevents runaway processing (default: 100)
2. **Stop on First Failure**: Option to halt on errors
3. **Delay Between Tasks**: Prevents system overload
4. **Dry Run Support**: Test continuous mode without making changes

### Failure Handling

When a task fails:
- Error logged with full context
- Task marked as failed in source
- If `stopOnFirstFailure=true`: processing stops immediately
- If `stopOnFirstFailure=false`: continues to next task

### Verification Gates

- Local checks must pass before PR creation
- CI checks must pass before merge
- Any failure stops the current task (not the whole session)

## Configuration Examples

### Development Mode

```bash
# Process up to 5 tasks with 10s delay, stop on failure
CONTINUOUS_MODE=true
CONTINUOUS_MAX_TASKS=5
CONTINUOUS_DELAY_MS=10000
STOP_ON_FIRST_FAILURE=true
AUTO_MERGE=false  # Don't auto-merge in dev
```

### Production Mode

```bash
# Process all tasks with minimal delay
CONTINUOUS_MODE=true
CONTINUOUS_MAX_TASKS=100
CONTINUOUS_DELAY_MS=5000
STOP_ON_FIRST_FAILURE=false
AUTO_MERGE=true
CLOSE_ISSUES_AFTER_MERGE=true
```

### Safe Mode (Dry Run)

```bash
# Test continuous mode without making changes
bun run apps/duyetbot-action/src/index.ts --continuous --dry-run
```

## Integration with Task Sources

### GitHub Issues

```yaml
# Label issues for processing
labels:
  - autonomous
  - agent-task

# Priority mapping
priority: critical > high > medium > low
```

### TASKS.md File

```markdown
# Tasks

## High Priority
- [ ] Implement user profiles
- [ ] Add search functionality

## Medium Priority
- [ ] Fix login bug
- [ ] Update documentation
```

### Memory MCP

Tasks stored in memory are also processed by continuous mode.

## Monitoring

### Session Statistics

The continuous mode summary shows:
- Total tasks completed
- Total tokens used
- Average time per task
- Total session time

### Per-Task Logging

Each task shows:
- Task number and title
- Source and priority
- Step-by-step progress
- Individual task statistics

## Best Practices

1. **Start Small**: Test with low `maxTasks` first (e.g., 3-5)
2. **Enable Dry Run**: Use `--dry-run` to test without making changes
3. **Set Reasonable Delays**: 5-10 seconds between tasks prevents rate limiting
4. **Monitor First Runs**: Watch the first few runs to ensure smooth operation
5. **Configure Auto-Merge Carefully**: Only enable in trusted environments

## Troubleshooting

### Agent stops after first task

Check `CONTINUOUS_MAX_TASKS` - ensure it's > 1

### Tasks not being picked up

- Verify task source configuration
- Check for proper labels on GitHub issues
- Ensure TASKS.md has unchecked items

### Issues not closing after merge

- Verify `CLOSE_ISSUES_AFTER_MERGE=true`
- Check `AUTO_MERGE=true` (issues only close after merge)
- Ensure token has `repo` write permissions

### Rate limiting errors

Increase `CONTINUOUS_DELAY_MS` to 10-30 seconds

## Future Enhancements

- [ ] Parallel task processing (multiple agents)
- [ ] Adaptive delays based on API rate limits
- [ ] Task prioritization by complexity
- [ ] Resume from checkpoint after interruption
- [ ] Integration with project management tools
