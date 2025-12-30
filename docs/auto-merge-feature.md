# Auto-Merge Feature - Implementation Summary

## Overview

The auto-merge feature enables `duyetbot-action` to automatically merge PRs after successfully completing tasks and passing all verification checks. This completes the autonomous loop: **Plan → Implement → Verify → PR → Auto-Merge → Done**.

## What It Does

### The Autonomous Loop

```
1. Task assigned (GitHub Issue)
   ↓
2. Agent analyzes and implements solution
   ↓
3. Verification checks run (type-check, lint, test, build)
   ↓
4. If verification passes:
   - Create PR with detailed description
   - Wait for CI checks to complete
   - Approve PR
   - Merge PR
   - Delete feature branch
   ↓
5. Close issue with completion comment
```

### Safety Features

1. **Verification Required**: Only auto-merges when all local checks pass
2. **CI Integration**: Waits for GitHub Actions checks to complete
3. **Required Checks**: Configurable list of required CI check names
4. **Timeout Protection**: Maximum wait time for CI checks
5. **Dry Run Support**: Can be disabled for testing

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTO_MERGE` | Enable auto-merge | `false` |
| `REQUIRED_CHECKS` | Comma-separated list of required CI checks | `ci,test` |
| `WAIT_FOR_CHECKS` | Wait for CI checks before merging | `true` |
| `AUTO_MERGE_TIMEOUT` | Max wait time for CI (milliseconds) | `600000` (10 min) |
| `AUTO_MERGE_APPROVE` | Approve PR before merging | `true` |
| `AUTO_MERGE_DELETE_BRANCH` | Delete branch after merge | `true` |

### Config Object

```typescript
{
  autoMerge: {
    enabled: true,
    requireChecks: ['ci', 'test'],
    waitForChecks: true,
    timeout: 600000,
    approveFirst: true,
    deleteBranch: true
  }
}
```

## Components

### 1. Auto-Merge Service (`auto-merge.ts`)

Standalone service for auto-merging PRs with CI check monitoring.

**Key Methods**:
- `autoMerge(prNumber, config)` - Main entry point
- `waitForChecks()` - Polls for CI completion
- `approvePR()` - Approves PR before merging
- `mergePR()` - Merges and optionally deletes branch

### 2. GitHub Reporter Integration (`github.ts`)

Enhanced `GitHubReporter` with auto-merge capabilities.

**New Methods**:
- `autoMergePR(prNumber)` - Auto-merge a PR
- `waitForChecks()` - Wait for CI checks
- `extractPRNumber()` - Parse PR number from URL

**Integration Point**: Auto-merge triggered after successful PR creation when `verificationPassed === true`.

### 3. Config Extensions (`config.ts`)

Added `autoMerge` and `selfImprovement` configuration sections.

**New Config Schema**:
```typescript
{
  autoMerge?: {
    enabled: boolean;
    requireChecks: string[];
    waitForChecks: boolean;
    timeout: number;
    approveFirst: boolean;
    deleteBranch: boolean;
  };
  selfImprovement?: {
    enableVerification: boolean;
    enableAutoFix: boolean;
    maxRecoveryAttempts: number;
  };
}
```

### 4. Report Context Extension (`types.ts`)

Added `verificationPassed?: boolean` to `ReportContext` for signaling successful verification.

## File Structure

```
apps/duyetbot-action/src/
├── self-improvement/
│   ├── auto-merge.ts          # Auto-merge service
│   ├── error-analyzer.ts       # Error parsing
│   ├── verification-loop.ts    # Pre-PR checks
│   ├── failure-memory.ts       # Pattern storage
│   └── index.ts                # Main exports
├── reporter/
│   ├── github.ts               # Enhanced with auto-merge
│   ├── types.ts                # Extended ReportContext
│   └── index.ts                # CombinedReporter with autoMerge
├── agent/
│   └── self-improving-loop.ts # Enhanced agent loop
├── config.ts                   # Extended config schema
└── index.ts                    # Main entry point with config passing
```

## Usage Example

### GitHub Actions Workflow

```yaml
- name: Run duyetbot-action
  env:
    AUTO_MERGE: "true"
    REQUIRED_CHECKS: "ci,test,lint"
    WAIT_FOR_CHECKS: "true"
  run: |
    bun run apps/duyetbot-action/src/index.ts \
      --source=github-issues \
      --task="${{ github.event.issue.number }}"
```

### What Happens

1. Agent receives task from GitHub Issue
2. Implements solution with Claude Agent SDK
3. Runs verification: `type-check`, `lint`, `test`, `build`
4. Creates PR if all checks pass
5. Polls GitHub for CI check completion
6. Approves PR
7. Merges PR
8. Deletes feature branch
9. Closes issue

## API

### AutoMergeService

```typescript
import { AutoMergeService } from './self-improvement/index.js';

const service = new AutoMergeService(
  githubToken,
  owner,
  repo
);

const result = await service.autoMerge(prNumber, {
  enabled: true,
  requireChecks: ['ci', 'test'],
  waitForChecks: true,
  timeout: 600000,
  approveFirst: true,
  deleteBranch: true
});

// result.merged: boolean
// result.reason?: string
// result.checksPassed: string[]
// result.checksFailed: string[]
```

### Convenience Function

```typescript
import { autoMergePR } from './self-improvement/index.js';

const result = await autoMergePR(
  githubToken,
  owner,
  repo,
  prNumber,
  { enabled: true }
);
```

## Error Handling

### Auto-Merge Failures

Auto-merge will NOT proceed if:

1. **Merge Conflicts**: PR has conflicts that need resolution
2. **CI Failures**: Required checks fail
3. **Timeout**: CI checks don't complete within timeout
4. **Permission Issues**: Token lacks write permissions

### Failure Behavior

On auto-merge failure:
- PR remains open for manual review
- Error logged but doesn't fail the task
- Issue can be manually closed later

## Monitoring

### Console Output

```
🔄 Auto-merging PR #123...
⏳ Waiting for CI checks...
   Checks pending: 3/5 complete
   Checks pending: 5/5 complete
✅ All 2 required checks passed
✅ PR approved
✅ PR merged
```

### GitHub Actions Summary

The workflow automatically updates with auto-merge status in the step summary.

## Security Considerations

1. **Token Permissions**: Requires `repo` scope with write access
2. **Branch Protection**: Should work with protected branches (token needs permissions)
3. **Required Checks**: Always verify required checks match actual CI names
4. **Approval Limits**: Respects any branch protection rules requiring approvals

## Future Enhancements

- [ ] Support for multiple approval requirements
- [ ] Configurable merge strategies (squash, rebase)
- [ ] PR comment before merging for transparency
- [ ] Integration with status checks API for better reliability
- [ ] Rollback capability if merge causes issues

## Testing

```bash
# Type-check
bun run type-check --filter=@duyetbot/duyetbot-action

# Test with dry-run (won't actually merge)
AUTO_MERGE=true DRY_RUN=true bun run apps/duyetbot-action/src/index.ts
```
