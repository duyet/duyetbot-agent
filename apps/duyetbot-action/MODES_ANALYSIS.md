# Mode Implementations Analysis

## Overview

duyetbot-action has three execution modes that handle different trigger scenarios:

1. **Agent Mode** - Direct automation for explicit prompts
2. **Tag Mode** - Interactive mode for @duyetbot mentions
3. **Continuous Mode** - Batch processing of multiple tasks

## Agent Mode (`src/modes/agent/index.ts`)

**Lines:** 265
**Purpose:** Direct automation mode for explicit prompts

### Triggers
- ✅ `workflow_dispatch` with `prompt` input
- ✅ Issue opened (`issues.opened`) - auto-trigger
- ✅ Issue labeled with `agent-task`
- ✅ Any context with explicit `prompt` input

### Current Implementation (HARDCODED)
```typescript
- Hardcoded tool list (9 tools)
- Hardcoded prompt generation logic
- Direct Octokit calls for:
  - CommentOps.createComment() - lines 83-99
  - LabelOps.addLabels() - lines 102-107
- Progress comment template built into code
```

### Issues to Address
1. **Hardcoded Tools** - `getAllowedTools()` returns static array
2. **Hardcoded Prompts** - Prompt generation is hardcoded
3. **Direct Octokit Usage** - Not using `github` tool
4. **Progress Comment Template** - Inline in code, not generic

## Tag Mode (`src/modes/tag/index.ts`)

**Lines:** 318
**Purpose:** Interactive mode triggered by @duyetbot mentions

### Triggers
- ✅ Issue/PR events with `@duyetbot` mention in body or comments
- ✅ Issue/PR labeled with `duyetbot`
- ❌ **MISSING**: Assignee trigger (documented in comment but NOT implemented)

### Current Implementation (HARDCODED)
```typescript
- Hardcoded tool list (9 tools)
- Hardcoded trigger phrase (@duyetbot)
- Hardcoded label trigger (duyetbot)
- Direct Octokit calls for:
  - CommentOps.findBotComment() - lines 102-13
  - CommentOps.updateComment() - lines 27-35
  - CommentOps.createComment() - lines 42-51
  - LabelOps.addLabels() - lines 56-61
- Progress comment template built into code
```

### Critical Issue: Missing Assignee Trigger
**Lines 25-30 (tag/index.ts) show:**
```typescript
/**
 * Tag mode triggers on:
 * - Issue/PR events with @duyetbot mention in body or comments
 * - Issue/PR labeled with "duyetbot"
 * - Issue/PR assigned to "duyetbot"  // ← Documented but NOT checked
 */
```

**`shouldTrigger()` function (lines 31-57) does NOT check for assignees:**
```typescript
shouldTrigger(context: GitHubContext): boolean {
  // Check for mention trigger - ✅
  const triggerPhrase = context.inputs.triggerPhrase?.toLowerCase() || '@duyetbot';
  const body = /*...*/;
  if (body.toLowerCase().includes(triggerPhrase)) {
    return true;
  }

  // Check for label trigger - ✅
  const labelTrigger = context.inputs.labelTrigger?.toLowerCase() || 'duyetbot';
  const labels = /*...*/;
  if (labels.some((l: any) => l.name?.toLowerCase() === labelTrigger)) {
    return true;
  }

  return false;  // ❌ No assignee check
}
```

### Issues to Address
1. **Hardcoded Tools** - `getAllowedTools()` returns static array
2. **Hardcoded Prompts** - Prompt generation is hardcoded
3. **Direct Octokit Usage** - Not using `github` tool
4. **Missing Assignee Trigger** - Documented but not implemented
5. **Progress Comment Template** - Inline in code, not generic

## Continuous Mode (`src/modes/continuous/index.ts`)

**Lines:** 236
**Purpose:** Batch processing of multiple tasks from configured sources

### Triggers
- ✅ `continuous_mode` input is `true`

### Current Implementation (HARDCODED)
```typescript
- Hardcoded tool list (10 tools, includes `continuous_mode`)
- Hardcoded task source configuration
- Hardcoded prompt generation logic
- Direct Octokit calls for:
  - CommentOps.createComment() - lines 52-70
  - LabelOps.addLabels() - lines 72-77
- Progress comment template built into code
```

### Issues to Address
1. **Hardcoded Tools** - `getAllowedTools()` returns static array
2. **Hardcoded Prompts** - Prompt generation is hardcoded
3. **Direct Octokit Usage** - Not using `github` tool
4. **Progress Comment Template** - Inline in code, not generic
5. **Task Source Logic** - Hardcoded, not skill-based

## Mode Detector (`src/modes/detector.ts`)

**Lines:** 118
**Purpose:** Automatically detect appropriate mode based on triggers

### Detection Priority (Lines 14-18)
```
1. continuous_mode input → continuous mode
2. @mention in entity events → tag mode
3. explicit prompt → agent mode
4. default (issue opened) → agent mode
```

### Current Implementation (HARDCODED)
```typescript
- Hardcoded mode priorities
- Hardcoded trigger phrase (@duyetbot)
- Hardcoded label trigger (duyetbot)
- Hardcoded label name (agent-task)
- No assignee check despite being documented
```

### Issues to Address
1. **Hardcoded Triggers** - Trigger phrases hardcoded
2. **Missing Assignee Trigger** - Not checking for assignees
3. **No Skill Integration** - Modes don't use skills
4. **No Dynamic Mode Loading** - Modes are static exports

## Summary of Hardcoded Logic

| Module | Lines | Hardcoded | Should Be |
|--------|-------|-----------|------------|
| Agent Mode | 265 | Tools, prompts, templates | Skills |
| Tag Mode | 318 | Tools, prompts, templates, triggers | Skills |
| Continuous Mode | 236 | Tools, prompts, templates | Skills |
| Detector | 118 | Triggers, priorities | Skills |
| **Total** | **937** | **~937 lines** | **Skills** |

## Missing Functionality

### 1. Assignee Trigger Support

**Status:** Documented but NOT implemented

**Where:**
- `tag/index.ts` lines 25-30 (comment only)
- `detector.ts` lines 20-22 (mentions assignee in priority list)
- `detector.ts` `checkForTrigger()` function (no assignee check)

**Expected Behavior:**
```typescript
// When issue/PR is assigned to @duyetbot, trigger tag mode
if (context.payload?.issue?.assignees?.some(a => a.login === 'duyetbot') ||
    context.payload?.pull_request?.assignees?.some(a => a.login === 'duyetbot')) {
  return true;
}
```

## Mode Types (`src/modes/types.ts`)

**Lines:** 113
**Purpose:** Type definitions for mode system

### Key Types
```typescript
ModeName = 'tag' | 'agent' | 'continuous'
Mode = Interface with:
  - shouldTrigger()
  - prepareContext()
  - getAllowedTools()
  - getDisallowedTools()
  - shouldCreateTrackingComment()
  - generatePrompt()
  - getSystemPrompt()
  - prepare()
```

### Analysis
- Well-structured interface
- Type-safe mode definitions
- BUT: Modes are static, not dynamically loaded

## Transform to Skills/Subagents

### Current Flow
```
GitHub Event → Detector → Mode → Hardcoded Logic → Octokit → Results
```

### Desired Flow
```
GitHub Event → Assignment Detector → Skill Matcher → Skill/Subagent → Tools → Results
```

### Mode → Skill Mapping

| Current Mode | Should Become | Subagent or Skill |
|-------------|---------------|-------------------|
| Agent | Default behavior | Skill-based (no specific subagent) |
| Tag | Interactive mode | `github_agent` subagent |
| Continuous | Batch processing | `github_agent` + `planner` subagents |

## Direct Octokit Usage (Summary)

| Mode | Lines | Octokit Calls | Should Be |
|------|-------|---------------|------------|
| Agent | 83-99, 102-107 | createComment, addLabels | github tool |
| Tag | 102-110, 27-35, 42-51, 56-61 | findBotComment, updateComment, createComment, addLabels | github tool |
| Continuous | 52-70, 72-77 | createComment, addLabels | github tool |
| **Total** | **~150 lines** | **~10 calls** | **github tool** |

## Recommendations

### 1. Use Skills for Mode-Specific Behavior

**Instead of hardcoded prompts, use skills:**
```markdown
# agent-mode-skill
## Triggers
- workflow_dispatch
- issue opened
- agent-task label

## Behavior
- Process explicit prompts
- Create PR for changes
```

### 2. Use Subagents for Specialized Tasks

**Instead of mode-specific logic, use subagents:**
```typescript
agents: [
  predefinedSubagents.githubAgent,  // For all GitHub operations
  predefinedSubagents.planner,      // For task planning
  // Custom subagents for specialized tasks
]
```

### 3. Implement Assignee Trigger

**Add to `detector.ts` and `tag/index.ts`:**
```typescript
function checkForAssignee(context: GitHubContext): boolean {
  const assignees = context.payload?.issue?.assignees ||
                    context.payload?.pull_request?.assignees ||
                    [];
  return assignees.some(a => a.login === 'duyetbot');
}
```

### 4. Replace Direct Octokit with github Tool

**Before:**
```typescript
await CommentOps.createComment(octokit, {...});
```

**After:**
```typescript
await agent.useTool('github', {
  action: 'create_comment',
  params: {...},
});
```

## Conclusion

**Key Findings:**
- ✅ 937 lines of hardcoded mode logic
- ✅ ~150 lines of direct Octokit usage
- ❌ Missing assignee trigger (documented but not implemented)
- ❌ No skill system integration
- ❌ No dynamic mode loading
- ❌ Modes use direct Octokit instead of github tool

**Next Steps:**
1. Design skill system to replace mode-specific logic
2. Implement assignee trigger support
3. Replace all Octokit calls with github tool
4. Create dynamic skill/subagent loading mechanism
