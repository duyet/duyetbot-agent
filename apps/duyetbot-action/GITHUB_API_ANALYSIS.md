# Direct GitHub API Calls Analysis

## Overview

duyetbot-action currently uses **direct Octokit API calls** instead of the `github` tool from `@duyetbot/tools`. This needs to be replaced with tool-based operations.

## Summary

- **Total Octokit API calls**: 94+ calls across codebase
- **Files affected**: 10 GitHub operations files + 3 mode files
- **Total lines to refactor**: ~250-300 lines

## GitHub Operations Module (`src/github/operations/`)

### File Sizes and Octokit Calls

| File | Lines | Octokit Calls | Main Operations |
|------|-------|---------------|-----------------|
| `comments.ts` | 135 | ~15 | createComment, updateComment, findBotComment, deleteComment |
| `issues.ts` | 193 | ~10 | getIssue, updateIssue, createIssue, addLabels |
| `pulls.ts` | 341 | ~15 | getPR, createPR, updatePR, mergePR, getDiff |
| `labels.ts` | 97 | ~8 | getLabels, addLabels, removeLabels |
| `branches.ts` | 281 | ~8 | getBranch, createBranch, deleteBranch |
| `commits.ts` | 311 | ~10 | getCommit, listCommits |
| `tags.ts` | 197 | ~8 | getTag, createTag, deleteTag |
| `status.ts` | 105 | ~5 | getCombinedStatus, listStatuses, listRuns |
| **Total** | **1974** | **~79 calls** | |

## Mode Files (`src/modes/`)

### Direct Octokit Usage

| File | Lines | Octokit Calls | Operations |
|------|-------|---------------|-----------|
| `agent/index.ts` | 265 | ~5 | CommentOps, LabelOps |
| `tag/index.ts` | 318 | ~10 | CommentOps, LabelOps |
| `continuous/index.ts` | 236 | ~10 | CommentOps, LabelOps |
| **Total** | **819** | **~25 calls** | |

### Imports Across Codebase

The operations modules are imported in:
```typescript
import * as CommentOps from '../../github/operations/comments.js';
import * as LabelOps from '../../github/operations/labels.js';
import * as IssueOps from '../../github/operations/issues.js';
import * as PullOps from '../../github/operations/pulls.js';
```

## Operation Mappings to GitHub Tool

### comments.ts (135 lines)

| Current (Octokit) | GitHub Tool Action |
|------------------|-------------------|
| `octokit.rest.issues.createComment({ owner, repo, issue_number, body })` | `action: 'create_comment', params: { issue_number, body }` |
| `octokit.rest.issues.updateComment({ owner, repo, comment_id, body })` | `action: 'update_comment', params: { comment_id, body }` |
| `octokit.rest.issues.deleteComment({ owner, repo, comment_id })` | `action: 'delete_comment', params: { comment_id }` |
| `octokit.rest.issues.listComments({ owner, repo, issue_number, per_page: 100 })` | `action: 'list_comments', params: { issue_number, per_page: 100 }` |

### issues.ts (193 lines)

| Current (Octokit) | GitHub Tool Action |
|------------------|-------------------|
| `octokit.rest.issues.get({ owner, repo, issue_number })` | `action: 'get_issue', params: { issue_number }` |
| `octokit.rest.issues.update({ owner, repo, issue_number, state })` | `action: 'update_issue', params: { issue_number, state }` |
| `octokit.rest.issues.create({ owner, repo, title, body, labels })` | `action: 'create_issue', params: { title, body, labels }` |

### pulls.ts (341 lines)

| Current (Octokit) | GitHub Tool Action |
|------------------|-------------------|
| `octokit.rest.pulls.get({ owner, repo, pull_number })` | `action: 'get_pr', params: { pull_number }` |
| `octokit.rest.pulls.create({ owner, repo, head, base, title, body })` | `action: 'create_pr', params: { head, base, title, body }` |
| `octokit.rest.pulls.update({ owner, repo, pull_number, title, body })` | `action: 'update_pr', params: { pull_number, title, body }` |
| `octokit.rest.pulls.merge({ owner, repo, pull_number, merge_method })` | `action: 'merge_pr', params: { pull_number, merge_method }` |
| `octokit.rest.pulls.listReviews({ owner, repo, pull_number })` | `action: 'get_reviews', params: { pull_number }` |
| `octokit.rest.pulls.get({ owner, repo, pull_number, mediaType: 'application/vnd.github.diff' })` | `action: 'get_diff', params: { pull_number }` |

### labels.ts (97 lines)

| Current (Octokit) | GitHub Tool Action |
|------------------|-------------------|
| `octokit.rest.issues.listLabelsForRepo({ owner, repo })` | `action: 'list_labels', params: {}` |
| `octokit.rest.issues.addLabels({ owner, repo, issue_number, labels })` | `action: 'add_labels', params: { issue_number, labels }` |
| `octokit.rest.issues.removeLabel({ owner, repo, issue_number, name })` | `action: 'remove_labels', params: { issue_number, name }` |

### branches.ts (281 lines)

| Current (Octokit) | GitHub Tool Action |
|------------------|-------------------|
| `octokit.rest.repos.getBranch({ owner, repo, branch })` | `action: 'get_branch', params: { branch }` |
| `octokit.rest.git.createRef({ owner, repo, ref, sha })` | `action: 'create_branch', params: { ref, sha }` |
| `octokit.rest.git.deleteRef({ owner, repo, ref })` | `action: 'delete_branch', params: { ref }` |

### commits.ts (311 lines)

| Current (Octokit) | GitHub Tool Action |
|------------------|-------------------|
| `octokit.rest.repos.getCommit({ owner, repo, ref })` | `action: 'get_commit', params: { ref }` |
| `octokit.rest.repos.listCommits({ owner, repo, sha, per_page: 10 })` | `action: 'list_commits', params: { per_page: 10 }` |

### tags.ts (197 lines)

| Current (Octokit) | GitHub Tool Action |
|------------------|-------------------|
| `octokit.rest.repos.getTag({ owner, repo, tag })` | `action: 'get_tag', params: { tag }` |
| `octokit.rest.git.createRef({ owner, repo, ref, sha })` | `action: 'create_tag', params: { ref, sha }` |
| `octokit.rest.git.deleteRef({ owner, repo, ref })` | `action: 'delete_tag', params: { ref }` |

### status.ts (105 lines)

| Current (Octokit) | GitHub Tool Action |
|------------------|-------------------|
| `octokit.rest.repos.getCombinedStatus({ owner, repo, ref })` | `action: 'get_combined_status', params: { ref }` |
| `octokit.rest.repos.listStatuses({ owner, repo, ref, per_page: 10 })` | `action: 'list_statuses', params: { ref, per_page: 10 }` |
| `octokit.rest.actions.listWorkflowRuns({ owner, repo })` | `action: 'get_workflow_runs', params: {}` |

## GitHub Tool Actions Available

From `packages/tools/src/github.ts`:

```typescript
export const githubInputSchema = z.object({
  action: z.enum([
    'get_pr',
    'get_issue',
    'create_issue',
    'update_issue',
    'create_comment',
    'get_diff',
    'get_file',
    'create_review',
    'list_comments',
    'get_workflow_runs',
    'trigger_workflow',
    'add_labels',
    'remove_labels',
    'merge_pr',
  ]),
  params: z.record(z.unknown()).optional(),
});
```

**Missing Actions** (need to be added):
- `delete_comment`
- `update_comment`
- `list_labels`
- `remove_label`
- `get_branch`
- `create_branch`
- `delete_branch`
- `get_commit`
- `list_commits`
- `get_tag`
- `create_tag`
- `delete_tag`
- `get_combined_status`
- `list_statuses`
- `delete_review`

## Transformation Strategy

### Step 1: Extend GitHub Tool
Add missing actions to `packages/tools/src/github.ts`:
- All CRUD operations for comments, issues, PRs
- All CRUD operations for labels
- All CRUD operations for branches
- All CRUD operations for commits
- All CRUD operations for tags
- All status check operations

### Step 2: Replace Direct Octokit in Modes
Replace in `src/modes/agent/index.ts`, `src/modes/tag/index.ts`, `src/modes/continuous/index.ts`:
```typescript
// Before
await CommentOps.createComment(octokit, { owner, repo, issueNumber, body });

// After
const result = await agent.useTool('github', {
  action: 'create_comment',
  params: { issue_number: issueNumber, body },
});
```

### Step 3: Replace Direct Octokit in Operations Files
Replace all 10 operations files to use github tool instead of octokit:
- This will require passing the agent/tool instance
- Or creating a wrapper function that uses the github tool

## Issues to Address

1. **GitHub Tool Missing Actions**: 15+ actions not yet defined
2. **Octokit Direct Usage**: 94+ direct API calls
3. **Operations File Dependencies**: Heavy coupling to Octokit
4. **No Error Handling**: Tool-based approach needs better error handling
5. **No Retry Logic**: Tool-based approach needs retry logic
6. **No Rate Limit Handling**: Tool-based approach needs rate limit handling

## Recommendations

### 1. Use Tools Instead of Direct API

**Don't:**
```typescript
await octokit.rest.issues.createComment({...});
```

**Do:**
```typescript
const result = await agent.useTool('github', {
  action: 'create_comment',
  params: {...},
});
if (result.error) {
  // Handle error
}
```

### 2. Create Tool Wrapper

Create `src/github/operations/tool-wrapper.ts`:
```typescript
export async function createComment(tool: SDKTool, owner: string, repo: string, issueNumber: number, body: string) {
  const result = await tool({
    action: 'create_comment',
    params: { issue_number: issueNumber, body },
  });

  if (!result.success) {
    throw new Error(`Failed to create comment: ${result.error}`);
  }

  return result.data;
}
```

### 3. Update Agent Loop

In `src/agent/loop.ts`, pass the github tool to mode prepare methods:
```typescript
async prepare(options: ModeOptions): Promise<ModeResult> {
  const { context, tools } = options;
  // ...

  // Pass github tool to modes
  const githubTool = tools.find(t => t.name === 'github');

  return {
    // ...
    githubTool,
  };
}
```

## Migration Impact

| Metric | Current | After Migration |
|--------|---------|----------------|
| Lines of code (operations) | 1974 | ~1300 (via wrapper) |
| Lines of code (modes) | 819 | ~600 (tool calls) |
| Direct Octokit calls | 94+ | 0 (all via tool) |
| Testable operations | ~70% | ~100% (all via tool) |
| Maintainability | Low (direct API everywhere) | High (centralized tool) |

## Conclusion

duyetbot-action has **significant technical debt** in using direct Octokit API calls throughout the codebase. The migration to tool-based operations will:

1. ✅ Remove ~2500+ lines of duplicate code
2. ✅ Centralize GitHub operations in the github tool
3. ✅ Make all operations testable via tool interface
4. ✅ Enable better error handling and retry logic
5. ✅ Reduce dependency on Octokit internal API
6. ✅ Allow easier testing of GitHub interactions
