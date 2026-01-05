# Mode Detector and Execution Flow Analysis

## Overview

Analysis of mode detection logic and execution flow in duyetbot-action to understand how modes are triggered, prepared, and executed.

## Mode Detection System

### Entry Points

duyetbot-action has 4 main entry points in `src/index.ts`:

```typescript
// 1. Execute agent with mode detection
export async function execute(options: ExecuteOptions): Promise<ExecuteResult>

// 2. Prepare mode for execution
export async function prepare(options: PrepareOptions): Promise<PrepareResult>

// 3. Report execution results
export async function report(options: ReportOptions): Promise<ReportResult>

// 4. Update tracking comment
export async function updateComment(options: UpdateCommentOptions): Promise<UpdateCommentResult>
```

### Mode Detector (`src/modes/detector.ts`)

**Purpose**: Determine which mode should be triggered based on input context.

**Key Functions**:

```typescript
export interface DetectionContext {
  owner: string;
  repo: string;
  issueNumber?: number;
  pullNumber?: number;
  content: string;
  labels?: string[];
  title?: string;
  assignee?: string;
  commentId?: number;
  isContinuousMode?: boolean;
}

export interface DetectionResult {
  mode: 'agent' | 'tag' | 'continuous';
  confidence: number;
  reason: string;
}

export async function detectMode(context: DetectionContext): Promise<DetectionResult>
```

**Detection Logic**:

1. **Check assignee** (NOT IMPLEMENTED - CRITICAL BUG):
   ```typescript
   // Line 92: Comment says "Check if assigned to @duyetbot"
   // But no actual check in shouldTrigger() functions
   if (assignee === 'duyetbot') {
     return { mode: 'tag', confidence: 1.0, reason: 'Assigned to @duyetbot' };
   }
   ```

2. **Check trigger phrase** (default: '@duyetbot'):
   ```typescript
   if (content.includes(triggerPhrase)) {
     return { mode: 'tag', confidence: 1.0, reason: 'Trigger phrase found' };
   }
   ```

3. **Check label trigger** (default: 'duyetbot'):
   ```typescript
   if (labels?.includes(labelTrigger)) {
     return { mode: 'tag', confidence: 1.0, reason: 'Label trigger found' };
   }
   ```

4. **Check for agent task**:
   ```typescript
   if (content.includes('agent-task') || labels?.includes('agent-task')) {
     return { mode: 'agent', confidence: 0.9, reason: 'Agent task detected' };
   }
   ```

5. **Check for continuous mode**:
   ```typescript
   if (isContinuousMode) {
     return { mode: 'continuous', confidence: 1.0, reason: 'Continuous mode enabled' };
   }
   ```

**Priority Order**:
1. Assignee (if implemented)
2. Trigger phrase (@duyetbot)
3. Label trigger (duyetbot)
4. Agent task detection
5. Continuous mode
6. Default: no mode detected

## Mode Execution Flow

### Phase 1: Mode Detection

```
execute() → detectMode() → DetectionResult
                              ↓
                         { mode, confidence, reason }
```

### Phase 2: Mode Preparation

```
DetectionResult → Mode.prepare()
                      ↓
                 PrepareResult
                  - context: ExecutionContext
                  - systemPrompt: string
                  - tools: Tool[]
                  - allowedTools: string[]
                  - disallowedTools: string[]
                  - tracking: TrackingConfig
```

### Phase 3: Agent Execution

```
PrepareResult → Agent.run()
                      ↓
                 ExecutionResult
                  - status: 'success' | 'error' | 'partial'
                  - output: string
                  - metadata: Record<string, unknown>
```

### Phase 4: Result Processing

```
ExecutionResult → report()
                      ↓
                 ReportResult
                  - comment: string
                  - labels: string[]
                  - status: string
```

## Mode Implementations

### Agent Mode (`src/modes/agent/index.ts`)

**Purpose**: Execute agent tasks with direct prompts or explicit task requests.

**Configuration**:

```typescript
interface AgentModeConfig {
  shouldTrigger: (context: DetectionContext) => boolean;
  getAllowedTools: () => string[];
  getDisallowedTools: () => string[];
  shouldCreateTrackingComment: () => boolean;
  generatePrompt: (context: ExecutionContext) => string;
  getSystemPrompt: () => string;
  prepare: (context: ExecutionContext) => Promise<PrepareResult>;
}
```

**Trigger Conditions**:
- Content contains 'agent-task' label
- Explicit prompt provided (not empty)
- Not a @duyetbot mention
- Not triggered by 'duyetbot' label

**Allowed Tools**: All tools enabled by default
**Disallowed Tools**: None
**Tracking Comment**: Yes, creates tracking comment
**System Prompt**: Uses `getAgentSystemPrompt()` from `@duyetbot/prompts`

**Prompt Generation**:
```typescript
generatePrompt(context: ExecutionContext): string {
  const { owner, repo, issueNumber, pullNumber, content } = context;
  return `
You are an AI agent working on ${owner}/${repo}.

Issue/PR: ${issueNumber || pullNumber}
Content: ${content}

Please help with this task.
`.trim();
}
```

**GitHub Operations** (Direct Octokit):
- `CommentOps.createComment()` - Create tracking comment
- `LabelOps.addLabels()` - Add status labels
- `IssueOps.updateIssue()` - Update issue state

**Lines of Code**: 265 lines
**Direct Octokit Calls**: ~5

---

### Tag Mode (`src/modes/tag/index.ts`)

**Purpose**: Handle @duyetbot mentions and 'duyetbot' label triggers.

**Configuration**:

```typescript
interface TagModeConfig {
  shouldTrigger: (context: DetectionContext) => boolean;
  getAllowedTools: () => string[];
  getDisallowedTools: () => string[];
  shouldCreateTrackingComment: () => boolean;
  generatePrompt: (context: ExecutionContext) => Promise<string>;
  getSystemPrompt: () => string;
  prepare: (context: ExecutionContext) => Promise<PrepareResult>;
}
```

**Trigger Conditions**:
- Content contains '@duyetbot' mention
- Issue/PR has 'duyetbot' label
- Assignee is '@duyetbot' (documented but NOT implemented)

**❌ CRITICAL BUG**: Lines 25-30 document assignee trigger but `shouldTrigger()` doesn't check it:
```typescript
// Line 25-30: Comment says
// "Check if assigned to @duyetbot
//  if (assignee === 'duyetbot') {
//    return true;
//  }"
// But the actual shouldTrigger() function does NOT check assignee
```

**Allowed Tools**: All tools enabled by default
**Disallowed Tools**: None
**Tracking Comment**: Yes, creates tracking comment
**System Prompt**: Uses `getTagModeSystemPrompt()` from `@duyetbot/prompts`

**Prompt Generation**:
```typescript
async generatePrompt(context: ExecutionContext): Promise<string> {
  const { owner, repo, issueNumber, pullNumber, content } = context;

  // Enrich context with GitHub data
  const issueData = await IssueOps.getIssue(octokit, { owner, repo, issueNumber });
  const comments = await CommentOps.listComments(octokit, { owner, repo, issueNumber });
  const labels = await LabelOps.getLabels(octokit, { owner, repo });

  return `
You are @duyetbot, an AI agent helping with ${owner}/${repo}.

Issue/PR #${issueNumber || pullNumber}:
Title: ${issueData.title}
Body: ${issueData.body}
Labels: ${labels.map(l => l.name).join(', ')}

Latest Comments:
${comments.map(c => `- ${c.user.login}: ${c.body}`).join('\n')}

@duyetbot mention:
${content}

Please help with this task.
`.trim();
}
```

**Context Enrichment** (Direct Octokit):
- `IssueOps.getIssue()` - Get issue/PR details
- `CommentOps.listComments()` - Get recent comments
- `LabelOps.getLabels()` - Get available labels

**GitHub Operations** (Direct Octokit):
- `CommentOps.createComment()` - Create tracking comment
- `CommentOps.updateComment()` - Update tracking comment
- `LabelOps.addLabels()` - Add status labels
- `LabelOps.removeLabels()` - Remove status labels

**Lines of Code**: 318 lines
**Direct Octokit Calls**: ~10

---

### Continuous Mode (`src/modes/continuous/index.ts`)

**Purpose**: Process multiple tasks in sequence with configurable limits.

**Configuration**:

```typescript
interface ContinuousModeConfig {
  shouldTrigger: (context: DetectionContext) => boolean;
  getAllowedTools: () => string[];
  getDisallowedTools: () => string[];
  shouldCreateTrackingComment: () => boolean;
  generatePrompt: (context: ExecutionContext) => string;
  getSystemPrompt: () => string;
  prepare: (context: ExecutionContext) => Promise<PrepareResult>;
}
```

**Trigger Conditions**:
- `continuous.enabled` setting is true
- `continuous.maxTasks` > 0
- Task source provides tasks
- Not a @duyetbot mention
- Not triggered by 'duyetbot' label

**Allowed Tools**: All tools enabled by default
**DisallowedTools**: None
**Tracking Comment**: Yes, creates tracking comment
**System Prompt**: Uses `getContinuousModeSystemPrompt()` from `@duyetbot/prompts`

**Prompt Generation**:
```typescript
generatePrompt(context: ExecutionContext): string {
  const { owner, repo, currentTask, taskIndex, totalTasks } = context;
  return `
You are an AI agent working on ${owner}/${repo}.

Continuous Mode - Processing task ${taskIndex + 1} of ${totalTasks}.

Current task:
${currentTask.description}

Please complete this task. The next task will be provided after this one is completed.
`.trim();
}
```

**Task Processing Loop**:
```typescript
async runContinuousMode(config: ContinuousConfig): Promise<ContinuousResult> {
  const results: TaskResult[] = [];
  let completed = 0;
  let failed = 0;

  while (completed < config.maxTasks && failed < config.maxFailures) {
    const task = await taskPicker.getNextTask();

    if (!task) {
      break; // No more tasks
    }

    try {
      const result = await executeAgent(task);
      results.push(result);
      completed++;

      if (config.delayBetweenTasks) {
        await sleep(config.delayBetweenTasks);
      }
    } catch (error) {
      failed++;
      results.push({ error, status: 'error' });
    }
  }

  return { results, completed, failed };
}
```

**GitHub Operations** (Direct Octokit):
- `CommentOps.createComment()` - Create tracking comment
- `CommentOps.updateComment()` - Update tracking comment with progress
- `LabelOps.addLabels()` - Add status labels
- `IssueOps.updateIssue()` - Update issue state

**Lines of Code**: 236 lines
**Direct Octokit Calls**: ~10

## Mode Execution Context

### ExecutionContext Interface

```typescript
export interface ExecutionContext {
  // Repository context
  owner: string;
  repo: string;

  // Issue/PR context
  issueNumber?: number;
  pullNumber?: number;
  commentId?: number;

  // Content
  content: string;
  title?: string;
  body?: string;

  // Labels
  labels?: string[];

  // Assignee
  assignee?: string;

  // Mode-specific
  mode: 'agent' | 'tag' | 'continuous';

  // Task (for continuous mode)
  currentTask?: Task;
  taskIndex?: number;
  totalTasks?: number;

  // Settings
  settings?: AgentSettings;

  // Octokit instance
  octokit: Octokit;
}
```

## Mode Execution Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     execute() Entry Point                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │   detectMode()         │
                   │   - Check assignee     │
                   │   - Check @duyetbot     │
                   │   - Check label        │
                   │   - Check agent-task   │
                   │   - Check continuous   │
                   └──────────┬─────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   DetectionResult      │
                   │   - mode               │
                   │   - confidence         │
                   │   - reason             │
                   └──────────┬─────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   Mode.prepare()       │
                   │   - Enrich context     │
                   │   - Generate prompt    │
                   │   - Select tools       │
                   │   - Build system       │
                   └──────────┬─────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   PrepareResult        │
                   │   - context            │
                   │   - systemPrompt       │
                   │   - tools              │
                   │   - allowedTools       │
                   │   - tracking           │
                   └──────────┬─────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   Agent.run()          │
                   │   - Initialize tools   │
                   │   - Start chat loop    │
                   │   - Tool iterations    │
                   │   - Collect results    │
                   └──────────┬─────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   ExecutionResult      │
                   │   - status            │
                   │   - output            │
                   │   - metadata           │
                   └──────────┬─────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   report()             │
                   │   - Process output     │
                   │   - Update comment     │
                   │   - Manage labels      │
                   │   - Update status      │
                   └──────────┬─────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   ReportResult         │
                   │   - comment            │
                   │   - labels             │
                   │   - status             │
                   └────────────────────────┘
```

## Mode Configuration Loading

Modes are loaded from `src/modes/` directory:

```typescript
export const MODES = {
  agent: {
    shouldTrigger: (context) => agentMode.shouldTrigger(context),
    getAllowedTools: () => agentMode.getAllowedTools(),
    getDisallowedTools: () => agentMode.getDisallowedTools(),
    shouldCreateTrackingComment: () => agentMode.shouldCreateTrackingComment(),
    generatePrompt: (context) => agentMode.generatePrompt(context),
    getSystemPrompt: () => agentMode.getSystemPrompt(),
    prepare: (context) => agentMode.prepare(context),
  },
  tag: {
    shouldTrigger: (context) => tagMode.shouldTrigger(context),
    getAllowedTools: () => tagMode.getAllowedTools(),
    getDisallowedTools: () => tagMode.getDisallowedTools(),
    shouldCreateTrackingComment: () => tagMode.shouldCreateTrackingComment(),
    generatePrompt: (context) => tagMode.generatePrompt(context),
    getSystemPrompt: () => tagMode.getSystemPrompt(),
    prepare: (context) => tagMode.prepare(context),
  },
  continuous: {
    shouldTrigger: (context) => continuousMode.shouldTrigger(context),
    getAllowedTools: () => continuousMode.getAllowedTools(),
    getDisallowedTools: () => continuousMode.getDisallowedTools(),
    shouldCreateTrackingComment: () => continuousMode.shouldCreateTrackingComment(),
    generatePrompt: (context) => continuousMode.generatePrompt(context),
    getSystemPrompt: () => continuousMode.getSystemPrompt(),
    prepare: (context) => continuousMode.prepare(context),
  },
};
```

## Key Issues Identified

### 1. Missing Assignee Trigger (CRITICAL BUG)

**Location**: `src/modes/detector.ts` line 92, `src/modes/tag/index.ts` lines 25-30

**Issue**: Documented but not implemented

**Impact**: @duyetbot assignments won't trigger the bot

**Fix Needed**: Add assignee check to `shouldTrigger()` function

### 2. Direct Octokit Usage in Modes

**Total**: ~25 direct Octokit calls across 3 mode files

**Impact**: Cannot use github tool, reduces testability

**Fix Needed**: Replace all direct Octokit calls with github tool usage

### 3. Hardcoded Mode Logic

**Total**: 937 lines of hardcoded mode logic

**Impact**: Cannot dynamically add modes without code changes

**Fix Needed**: Move mode logic to `.md` skills

### 4. No Mode Registry

**Issue**: Modes are hardcoded in MODES object

**Impact**: Cannot dynamically load modes

**Fix Needed**: Implement mode loader/registry system

## Transformation Strategy

### Phase 1: Fix Critical Bugs

1. **Add assignee trigger** to detector.ts
2. **Fix shouldTrigger()** in tag/index.ts

### Phase 2: Replace Direct Octokit with GitHub Tool

1. Create tool wrapper functions for operations
2. Replace all ~25 Octokit calls in modes
3. Update prepare() methods to pass github tool

### Phase 3: Move Mode Logic to Skills

1. Create `.claude/skills/` directory
2. Create skills for each mode:
   - `agent-mode.md`
   - `tag-mode.md`
   - `continuous-mode.md`
3. Implement skill loader
4. Update mode prepare() to use skills

### Phase 4: Add Dynamic Mode Loading

1. Create mode registry
2. Implement mode loader from skills
3. Support custom modes via skills

## Next Steps

1. ✅ **Complete**: Document mode detection logic
2. ✅ **Complete**: Document mode execution flow
3. ✅ **Complete**: Document mode implementations
4. ✅ **Complete**: Identify critical bugs
5. ⏭️ **Next**: Document error handling and retry logic

## Conclusion

The mode detection and execution flow has:

- **3 modes**: agent, tag, continuous
- **937 lines** of hardcoded mode logic
- **~25 direct Octokit calls** in modes
- **1 critical bug**: Missing assignee trigger

The transformation needs to:
- Fix the assignee trigger bug
- Replace all direct Octokit calls with github tool
- Move mode logic to `.md` skills
- Implement dynamic mode loading
