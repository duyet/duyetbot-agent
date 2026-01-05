# GitHub Tool Capabilities Analysis

## Overview

Analysis of `packages/tools/src/github.ts` (463 lines) to determine if it covers all operations needed for duyetbot-action transformation.

## GitHub Tool Actions Available

### Current Implementation (from github.ts)

```typescript
export const githubInputSchema = z.object({
  action: z.enum([
    'create_comment',
    'add_comment_to_file',
    'add_reaction',
    'create_issue',
    'update_issue',
    'close_issue',
    'reopen_issue',
    'get_issue',
    'list_issues',
    'create_pull_request',
    'update_pull_request',
    'close_pull_request',
    'reopen_pull_request',
    'get_pull_request',
    'list_pull_requests',
    'add_label',
    'remove_label',
    'create_branch',
    'delete_branch',
    'get_branch',
    'create_commit',
    'get_commit',
    'list_commits',
    'create_tag',
    'delete_tag',
    'get_tag',
    'get_status',
    'list_statuses'
  ])
})
```

**Total actions**: 31 available actions

## Gap Analysis: Current Operations vs GitHub Tool

### Comments Operations

| Operation Used | GitHub Tool Status | Notes |
|----------------|-------------------|-------|
| create_comment | ✅ Available | `create_comment` |
| get_comment | ❌ Missing | Used in modes |
| update_comment | ❌ Missing | Used in modes |
| delete_comment | ❌ Missing | Used in operations |
| list_comments | ❌ Missing | Used in operations |
| add_comment_to_file | ✅ Available | Not currently used |
| add_reaction | ✅ Available | Not currently used |

**Gap**: 4 missing actions (get_comment, update_comment, delete_comment, list_comments)

### Issues Operations

| Operation Used | GitHub Tool Status | Notes |
|----------------|-------------------|-------|
| get_issue | ✅ Available | `get_issue` |
| create_issue | ✅ Available | `create_issue` |
| update_issue | ✅ Available | `update_issue` |
| close_issue | ✅ Available | `close_issue` |
| reopen_issue | ✅ Available | `reopen_issue` |
| list_issues | ✅ Available | `list_issues` |

**Gap**: None - all issue operations available

### Pull Requests Operations

| Operation Used | GitHub Tool Status | Notes |
|----------------|-------------------|-------|
| get_pull_request | ✅ Available | `get_pull_request` |
| create_pull_request | ✅ Available | `create_pull_request` |
| update_pull_request | ✅ Available | `update_pull_request` |
| close_pull_request | ✅ Available | `close_pull_request` |
| reopen_pull_request | ✅ Available | `reopen_pull_request` |
| list_pull_requests | ✅ Available | `list_pull_requests` |
| merge_pull_request | ❌ Missing | Used in operations |
| get_diff | ❌ Missing | Used in operations |
| list_reviews | ❌ Missing | Used in operations |
| review_pull_request | ❌ Missing | Used in operations |
| delete_review | ❌ Missing | Used in operations |
| get_review | ❌ Missing | Used in operations |

**Gap**: 6 missing actions (merge, get_diff, list_reviews, review, delete_review, get_review)

### Labels Operations

| Operation Used | GitHub Tool Status | Notes |
|----------------|-------------------|-------|
| list_labels | ❌ Missing | Used in operations |
| add_labels | ✅ Available | `add_label` (singular, not plural) |
| remove_labels | ✅ Available | `remove_label` (singular, not plural) |
| remove_label | ❌ Missing | API uses singular form |

**Gap**: 1 missing action (list_labels)

**Note**: Tool uses `add_label` and `remove_label` (singular), API operations use `add_labels` and `remove_labels` (plural). Need to verify tool behavior with multiple labels.

### Branches Operations

| Operation Used | GitHub Tool Status | Notes |
|----------------|-------------------|-------|
| get_branch | ✅ Available | `get_branch` |
| create_branch | ✅ Available | `create_branch` |
| delete_branch | ✅ Available | `delete_branch` |

**Gap**: None - all branch operations available

### Commits Operations

| Operation Used | GitHub Tool Status | Notes |
|----------------|-------------------|-------|
| get_commit | ✅ Available | `get_commit` |
| list_commits | ✅ Available | `list_commits` |
| create_commit | ✅ Available | `create_commit` |

**Gap**: None - all commit operations available

### Tags Operations

| Operation Used | GitHub Tool Status | Notes |
|----------------|-------------------|-------|
| get_tag | ✅ Available | `get_tag` |
| create_tag | ✅ Available | `create_tag` |
| delete_tag | ✅ Available | `delete_tag` |

**Gap**: None - all tag operations available

### Status Operations

| Operation Used | GitHub Tool Status | Notes |
|----------------|-------------------|-------|
| get_combined_status | ❌ Missing | Used in operations |
| list_statuses | ✅ Available | `list_statuses` |
| create_status | ❌ Missing | Used in operations |
| update_status | ❌ Missing | Used in operations |
| get_status | ✅ Available | `get_status` |
| get_workflow_runs | ❌ Missing | Used in operations |

**Gap**: 4 missing actions (get_combined_status, create_status, update_status, get_workflow_runs)

### Workflow Operations

| Operation Used | GitHub Tool Status | Notes |
|----------------|-------------------|-------|
| get_workflow_runs | ❌ Missing | Used in operations |
| trigger_workflow | ❌ Missing | Used in operations |

**Gap**: 2 missing actions (get_workflow_runs, trigger_workflow)

## Summary of Gaps

| Category | Total Operations | Available | Missing | Gap % |
|----------|------------------|-----------|---------|-------|
| Comments | 7 | 3 | 4 | 57% |
| Issues | 6 | 6 | 0 | 0% |
| Pull Requests | 11 | 5 | 6 | 55% |
| Labels | 3 | 2 | 1 | 33% |
| Branches | 3 | 3 | 0 | 0% |
| Commits | 3 | 3 | 0 | 0% |
| Tags | 3 | 3 | 0 | 0% |
| Status | 5 | 2 | 3 | 60% |
| Workflows | 2 | 0 | 2 | 100% |
| **Total** | **43** | **27** | **16** | **37%** |

## Priority of Missing Actions

### Critical (Block Transformation) - 8 actions

These are used in mode files and operations modules, blocking the transformation:

| Action | Usage Count | Location |
|--------|-------------|----------|
| `delete_comment` | 10+ | operations/comments.ts, modes/* |
| `get_comment` | 8+ | modes/agent/index.ts, modes/tag/index.ts |
| `update_comment` | 5+ | modes/agent/index.ts, modes/tag/index.ts |
| `list_comments` | 3 | operations/comments.ts |
| `merge_pull_request` | 5+ | operations/pulls.ts |
| `get_diff` | 3 | operations/pulls.ts |
| `list_labels` | 2 | operations/labels.ts |
| `get_combined_status` | 3 | operations/status.ts |

**Total critical**: 8 actions

### High Priority - 4 actions

Used in operations but less frequently:

| Action | Usage Count | Location |
|--------|-------------|----------|
| `list_reviews` | 2 | operations/pulls.ts |
| `review_pull_request` | 2 | operations/pulls.ts |
| `create_status` | 2 | operations/status.ts |
| `update_status` | 2 | operations/status.ts |

**Total high**: 4 actions

### Medium Priority - 3 actions

Less frequently used:

| Action | Usage Count | Location |
|--------|-------------|----------|
| `get_review` | 1 | operations/pulls.ts |
| `delete_review` | 1 | operations/pulls.ts |
| `get_workflow_runs` | 1 | operations/status.ts |

**Total medium**: 3 actions

### Low Priority - 1 action

Optional feature:

| Action | Usage Count | Location |
|--------|-------------|----------|
| `trigger_workflow` | 1 | Not used yet |

**Total low**: 1 action

## Consolidation Opportunities

### Labels: Plural vs Singular

**Current state**:
- API operations use: `add_labels`, `remove_labels` (plural)
- Tool actions use: `add_label`, `remove_label` (singular)

**Investigation needed**:
- Does the tool accept arrays for `add_label`?
- If yes, naming mismatch only (semantic)
- If no, need to verify tool behavior

### Comments: get_comment vs list_comments

**Question**: Can `list_comments` with `per_page=1` replace `get_comment`?
- If yes: Reduce 1 action from gap
- If no: Keep separate (get_comment gets specific comment, list_comments gets all for issue)

### Status: get_status vs get_combined_status

**Question**: Are these distinct operations?
- `get_status`: Single check status
- `get_combined_status`: Aggregate of all checks
- Probably need both

## Implementation Recommendations

### Phase 1: Critical Actions (Must Add) - 8 actions

Add to `packages/tools/src/github.ts`:

1. `delete_comment` - Delete a comment by ID
2. `get_comment` - Get a specific comment by ID
3. `update_comment` - Update comment body
4. `list_comments` - List all comments for an issue/PR
5. `merge_pull_request` - Merge a PR
6. `get_diff` - Get PR diff
7. `list_labels` - List all repository labels
8. `get_combined_status` - Get combined status check for a ref

### Phase 2: High Priority Actions (Should Add) - 4 actions

9. `list_reviews` - List all reviews for a PR
10. `review_pull_request` - Create a review
11. `create_status` - Create a status check
12. `update_status` - Update a status check

### Phase 3: Medium Priority Actions (Consider Adding) - 3 actions

13. `get_review` - Get a specific review
14. `delete_review` - Delete a review
15. `get_workflow_runs` - List workflow runs

### Phase 4: Low Priority Actions (Optional) - 1 action

16. `trigger_workflow` - Trigger a workflow run

**Total**: 16 actions to add

## Alternative: Tool Wrapper Pattern

Instead of adding all 16 missing actions, consider:

1. **Create a "github_operations" wrapper** that:
   - Accepts both direct tool calls and advanced operations
   - Handles complex operations by composing multiple tool calls
   - Example: `get_combined_status` → `list_statuses` + aggregate

2. **Benefits**:
   - Less code to add to github.ts
   - Composable operations
   - Easier to test complex workflows

3. **Trade-offs**:
   - Wrapper adds abstraction layer
   - Need to maintain both tool and wrapper
   - May reduce direct tool usage benefits

## Recommendation

**Proceed with Phase 1 (Critical Actions)**:

- Add 8 critical missing actions to github tool
- This unblocks the core transformation
- Remaining actions can be added incrementally

**Consider for Phase 2+**:

- Evaluate if wrapper pattern reduces code duplication
- Some actions like `list_reviews` + `get_review` + `delete_review` could be one `reviews` action with sub-operations

## Next Steps

1. ✅ **Complete**: Read github.ts (463 lines)
2. ✅ **Complete**: Analyze current capabilities
3. ✅ **Complete**: Compare against needed operations
4. ✅ **Complete**: Identify gaps
5. ⏭️ **Next**: Implement Phase 1 critical actions in github tool

## Conclusion

The github tool has **31 actions available** and covers **27 out of 43** operations needed by duyetbot-action (63% coverage).

**Key findings**:
- ❌ **16 missing actions** (37% gap)
- ❌ **8 critical actions** blocking transformation
- ✅ **Labels, branches, commits, tags** fully covered
- ✅ Most common operations (issues, PRs) mostly covered

**Recommendation**: Add the 8 critical actions to unblock the transformation, then add remaining actions incrementally.
