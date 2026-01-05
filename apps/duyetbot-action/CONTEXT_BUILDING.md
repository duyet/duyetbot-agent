# Context Building for Agent Execution Analysis

## Overview

Analysis of how context is built and passed to the agent for execution in duyetbot-action.

## Context Types

duyetbot-action uses multiple context types across the execution pipeline:

```text
GitHubContext → ModeContext → ExecutionContext → ReportContext
     ↓              ↓                ↓                 ↓
  (Raw)          (Prepared)        (Execution)        (Reporting)
```

### 1. GitHubContext

**File**: `src/github/context.ts` (292 lines)

**Purpose**: Raw GitHub context parsed from environment variables and event payload.

```typescript
export interface GitHubContext {
  // Event information
  eventName: string;
  eventAction?: string;
  payload?: any;

  // Repository information
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };

  // Entity (issue/PR) information
  entityNumber?: number;
  isPR: boolean;

  // Actor information
  actor: string;

  // Workflow information
  runId: string;
  runNumber: string;
  runAttempt: string;

  // Inputs from GitHub Action
  inputs: {
    prompt?: string;
    settings?: string;
    settingsObject?: Settings;
    triggerPhrase?: string;
    labelTrigger?: string;
    taskSource?: string;
    baseBranch?: string;
    botName?: string;
    continuousMode?: string;
    maxTasks?: string;
    delayBetweenTasks?: string;
    autoMerge?: string;
    closeIssues?: string;
    allowedNonWriteUsers?: string;
    githubToken?: string;
  };
}
```

**Sources**:
- Environment variables (`GITHUB_EVENT_NAME`, `GITHUB_REPOSITORY`, etc.)
- Event payload file (`GITHUB_EVENT_PATH`)
- Action inputs (workflow dispatch, manual trigger)

**Parsing Logic**:

```typescript
export function parseGitHubContext(): GitHubContext {
  // Event information
  const eventName = core.getInput('eventName', { required: true });
  const eventAction = core.getInput('eventAction');

  // Repository
  const [owner, name] = process.env.GITHUB_REPOSITORY!.split('/');

  // Entity detection
  const isPR = eventName === 'pull_request' || eventName === 'pull_request_review';
  const entityNumber = extractEntityNumber(payload, eventName);

  // Actor
  const actor = core.getInput('actor', { required: true });

  // Workflow
  const runId = process.env.GITHUB_RUN_ID!;
  const runNumber = process.env.GITHUB_RUN_NUMBER!;
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT!;

  // Parse settings from JSON input
  const settingsInput = core.getInput('settings') || '{}';
  const settingsObject = JSON.parse(settingsInput);

  return {
    eventName,
    eventAction,
    payload,
    repository: { owner, name, fullName: `${owner}/${name}` },
    entityNumber,
    isPR,
    actor,
    runId,
    runNumber,
    runAttempt,
    inputs: {
      prompt: core.getInput('prompt'),
      settings: settingsInput,
      settingsObject,
      // ... other inputs
    },
  };
}
```

### 2. ModeContext

**File**: `src/modes/types.ts` (112 lines)

**Purpose**: Prepared context for a specific mode.

```typescript
export type ModeContext = {
  mode: 'agent' | 'tag' | 'continuous';
  githubContext: GitHubContext;

  // Optional fields
  commentId?: number;
  taskId?: string;
  baseBranch?: string;
  claudeBranch?: string;

  // Task context (for continuous mode)
  currentTask?: any;
  taskIndex?: number;
  totalTasks?: number;
};
```

**Creation Flow**:

```typescript
// Mode's prepareContext() method
prepareContext(context: GitHubContext, data?: Partial<ModeResult>): ModeContext {
  const result: ModeContext = {
    mode: 'agent', // or 'tag' or 'continuous'
    githubContext: context,
  };

  // Add optional fields from previous prepare() result
  if (data?.commentId !== undefined) result.commentId = data.commentId;
  if (data?.taskId !== undefined) result.taskId = data.taskId;
  if (data?.branchInfo?.baseBranch !== undefined) result.baseBranch = data.branchInfo.baseBranch;
  if (data?.branchInfo?.claudeBranch !== undefined) result.claudeBranch = data.branchInfo.claudeBranch;

  return result;
}
```

### 3. ExecutionContext

**Purpose**: Context passed to agent for execution (used in agent loop).

```typescript
interface ExecutionContext {
  // Task description
  description: string;

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

**Creation Flow**:

```typescript
// In execute entrypoint
const modeContext = modeInstance.prepareContext(context, prepareData);
const prompt = modeInstance.generatePrompt(modeContext);

// ExecutionContext is built from:
// 1. ModeContext
// 2. Task description
// 3. Octokit instance
// 4. Settings
```

### 4. ReportContext

**File**: `src/reporter/types.ts` (53 lines)

**Purpose**: Context for reporting task results.

```typescript
export interface ReportContext {
  // Task information
  taskId: string;
  taskSource: string;
  task?: Task;

  // Execution results
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  tokensUsed: number;
  stepsCompleted?: number;

  // Verification results
  verificationPassed?: boolean;

  // GitHub information
  issueNumber?: number;
  branch?: string;
  prUrl?: string;

  // Mode information
  mode?: string;
}
```

**Creation Flow**:

```typescript
// In index.ts
function buildReportContext(
  task: Task,
  result: AgentResult,
  duration: number
): ReportContext {
  const context: ReportContext = {
    taskId: task.id,
    taskSource: task.source,
    success: result.success,
    output: result.output,
    duration,
    tokensUsed: result.tokensUsed,
    stepsCompleted: result.stepsCompleted,
  };

  if (result.error) {
    context.error = result.error;
  }

  if (result.verificationPassed !== undefined) {
    context.verificationPassed = result.verificationPassed;
  }

  return context;
}
```

## Context Building Pipeline

### Step 1: Parse GitHub Context

```typescript
// Entry: Environment variables + event payload
const context = parseGitHubContext();

// Output: GitHubContext
```

**Data Sources**:
- `GITHUB_EVENT_NAME` - Event type (issues, pull_request, etc.)
- `GITHUB_EVENT_PATH` - Path to event payload JSON file
- `GITHUB_REPOSITORY` - Owner/repo (duyet/duyetbot-agent)
- `GITHUB_ACTOR` - User who triggered the action
- `GITHUB_RUN_ID` - Workflow run ID
- `GITHUB_RUN_NUMBER` - Workflow run number
- `GITHUB_RUN_ATTEMPT` - Retry attempt number
- Action inputs (prompt, settings, etc.)

### Step 2: Detect Mode

```typescript
// Entry: GitHubContext
const mode = getMode(context);

// Output: Mode object
```

**Mode Detection Logic** (from `src/modes/detector.ts`):

```typescript
function detectMode(context: GitHubContext): AutoDetectedMode {
  // 1. Check continuous mode
  if (context.inputs.settingsObject?.continuous?.enabled) {
    return { mode: 'continuous', confidence: 1.0, reason: 'Continuous mode enabled' };
  }

  // 2. Check for trigger phrase or label
  const hasTrigger = checkForTrigger(context);

  // 3. Check for prompt input
  const hasPrompt = !!context.inputs.prompt;

  // 4. Determine mode based on conditions
  if (hasTrigger && context.entityNumber) {
    return { mode: 'tag', confidence: 1.0, reason: 'Trigger found' };
  }

  if (hasPrompt || context.eventName === 'workflow_dispatch') {
    return { mode: 'agent', confidence: 0.9, reason: 'Explicit prompt' };
  }

  // Default: no mode detected
  return { mode: 'none', confidence: 0.0, reason: 'No trigger detected' };
}
```

### Step 3: Prepare Mode Context

```typescript
// Entry: GitHubContext + optional prepare data
const modeContext = modeInstance.prepareContext(context, prepareData);

// Output: ModeContext
```

**Per-Mode Context Preparation**:

#### Agent Mode

```typescript
prepareContext(context: GitHubContext, data?: Partial<ModeResult>): ModeContext {
  const result: ModeContext = {
    mode: 'agent',
    githubContext: context,
  };

  // Add optional fields
  if (data?.commentId !== undefined) result.commentId = data.commentId;
  if (data?.taskId !== undefined) result.taskId = data.taskId;
  if (data?.branchInfo?.baseBranch !== undefined) result.baseBranch = data.branchInfo.baseBranch;
  if (data?.branchInfo?.claudeBranch !== undefined) result.claudeBranch = data.branchInfo.claudeBranch;

  return result;
}
```

#### Tag Mode

```typescript
prepareContext(context: GitHubContext, data?: Partial<ModeResult>): ModeContext {
  const result: ModeContext = {
    mode: 'tag',
    githubContext: context,
  };

  // Add optional fields
  if (data?.commentId !== undefined) result.commentId = data.commentId;
  if (data?.taskId !== undefined) result.taskId = data.taskId;
  if (data?.branchInfo?.baseBranch !== undefined) result.baseBranch = data.branchInfo.baseBranch;
  if (data?.branchInfo?.claudeBranch !== undefined) result.claudeBranch = data.branchInfo.claudeBranch;

  return result;
}
```

#### Continuous Mode

```typescript
prepareContext(context: GitHubContext, data?: Partial<ModeResult>): ModeContext {
  const result: ModeContext = {
    mode: 'continuous',
    githubContext: context,
  };

  // Add optional fields
  if (data?.commentId !== undefined) result.commentId = data.commentId;
  if (data?.taskId !== undefined) result.taskId = data.taskId;
  if (data?.branchInfo?.baseBranch !== undefined) result.baseBranch = data.branchInfo.baseBranch;
  if (data?.branchInfo?.claudeBranch !== undefined) result.claudeBranch = data.branchInfo.claudeBranch;

  return result;
}
```

### Step 4: Generate Prompt

```typescript
// Entry: ModeContext
const prompt = modeInstance.generatePrompt(modeContext);

// Output: string (user prompt for LLM)
```

**Per-Mode Prompt Generation**:

#### Agent Mode Prompt

```typescript
generatePrompt(context: ModeContext): string {
  const { githubContext } = context;

  let prompt = `You are duyetbot, an AI coding assistant.\n\n`;

  // Task description
  if (promptInput) {
    prompt += `## Task\n\n${promptInput}\n\n`;
  } else if (githubContext.eventName === 'issues' && githubContext.entityNumber) {
    // Use issue content
    const issue = githubContext.payload?.issue;
    prompt += `## Task\n\n`;
    prompt += `Process this issue:\n\n`;
    prompt += `**Title:** ${issue?.title}\n\n`;
    prompt += `**Body:**\n${issue?.body || '(No description)'}\n\n`;
  } else {
    prompt += `## Task\n\nHelp with this repository.\n\n`;
  }

  // Repository context
  prompt += `## Repository Context\n\n`;
  prompt += `- **Repository**: ${githubContext.repository.fullName}\n`;
  if (githubContext.entityNumber) {
    const entityType = githubContext.isPR ? 'Pull Request' : 'Issue';
    prompt += `- **${entityType}**: #${githubContext.entityNumber}\n`;
    prompt += `- **URL**: https://github.com/${githubContext.repository.fullName}/${githubContext.isPR ? 'pull' : 'issues'}/${githubContext.entityNumber}\n`;
  }

  // Instructions
  prompt += `\n## Instructions\n\n`;
  prompt += `1. Understand task and analyze codebase\n`;
  prompt += `2. Create a plan for implementation\n`;
  prompt += `3. Implement changes\n`;
  prompt += `4. Test and verify changes\n`;
  prompt += `5. Report results\n`;

  return prompt;
}
```

#### Tag Mode Prompt

```typescript
generatePrompt(context: ModeContext): string {
  const { githubContext } = context;
  const triggerPhrase = githubContext.inputs.triggerPhrase || '@duyetbot';

  // Extract request from trigger
  const body =
    githubContext.payload?.comment?.body ||
    githubContext.payload?.issue?.body ||
    githubContext.payload?.pull_request?.body ||
    '';

  const triggerIndex = body.toLowerCase().indexOf(triggerPhrase.toLowerCase());
  let request = '';
  if (triggerIndex !== -1) {
    request = body.slice(triggerIndex + triggerPhrase.length).trim();
  } else {
    request = body.trim();
  }

  // Build prompt
  let prompt = 'You are duyetbot, an AI coding assistant.\n\n';
  prompt += `## Task\n\n${request || 'Help with this issue.'}\n\n`;

  // Issue/PR context
  if (githubContext.entityNumber) {
    const entityType = githubContext.isPR ? 'Pull Request' : 'Issue';
    prompt += `## ${entityType} Context\n\n`;
    prompt += `- **Number**: #${githubContext.entityNumber}\n`;
    prompt += `- **Repository**: ${githubContext.repository.fullName}\n`;
    prompt += `- **URL**: https://github.com/${githubContext.repository.fullName}/${githubContext.isPR ? 'pull' : 'issues'}/${githubContext.entityNumber}\n`;

    // Labels
    const labels = githubContext.payload?.issue?.labels || githubContext.payload?.pull_request?.labels || [];
    if (labels.length > 0) {
      prompt += `- **Labels**: ${labels.map(l => l.name).join(', ')}\n`;
    }
  }

  // Instructions
  prompt += `\n## Instructions\n\n`;
  prompt += `1. Analyze request and codebase\n`;
  prompt += `2. Create a plan for changes needed\n`;
  prompt += `3. Implement changes on a new branch\n`;
  prompt += `4. Create a pull request with your changes\n`;
  prompt += `5. Add a summary comment when done\n`;

  // Additional context
  if (githubContext.inputs.prompt) {
    prompt += `\n## Additional Context\n\n${githubContext.inputs.prompt}\n`;
  }

  return prompt;
}
```

#### Continuous Mode Prompt

```typescript
generatePrompt(context: ModeContext): string {
  const { githubContext } = context;

  let prompt = 'You are duyetbot, an AI coding assistant.\n\n';
  prompt += `## Task\n\nProcess multiple tasks in continuous mode.\n\n`;

  // Configuration
  const maxTasks = parseInt(githubContext.inputs.maxTasks || '100', 10);
  const taskSource = githubContext.inputs.taskSource || 'github-issues';

  prompt += `## Configuration\n\n`;
  prompt += `- **Max Tasks**: ${maxTasks}\n`;
  prompt += `- **Task Source**: ${taskSource}\n`;
  prompt += `- **Auto-Merge**: ${githubContext.inputs.autoMerge || 'true'}\n`;
  prompt += `- **Close Issues**: ${githubContext.inputs.closeIssues || 'true'}\n`;

  // Task information (added during loop)
  if (context.currentTask) {
    prompt += `\n## Current Task\n\n`;
    prompt += `Task ${context.taskIndex! + 1} of ${context.totalTasks}:\n\n`;
    prompt += `${context.currentTask.description}\n\n`;
  }

  // Instructions
  prompt += `\n## Instructions\n\n`;
  prompt += `1. Complete the current task\n`;
  prompt += `2. Create a pull request if needed\n`;
  prompt += `3. Wait for the next task\n`;
  prompt += `4. Repeat until max tasks reached or no more tasks\n`;

  // Initial context
  if (githubContext.inputs.prompt) {
    prompt += `\n## Initial Context\n\n${githubContext.inputs.prompt}\n`;
  }

  return prompt;
}
```

### Step 5: Generate System Prompt

```typescript
// Entry: ModeContext
const systemPrompt = modeInstance.getSystemPrompt(modeContext);

// Output: string (system prompt for LLM)
```

**Per-Mode System Prompt Generation**:

#### All Modes (similar pattern)

```typescript
getSystemPrompt(context: ModeContext): string {
  const { githubContext } = context;

  let systemPrompt = '\n## GitHub Context\n\n';
  systemPrompt += `- **Actor**: ${githubContext.actor}\n`;
  systemPrompt += `- **Event**: ${githubContext.eventName}`;
  if (githubContext.eventAction) {
    systemPrompt += ` (${githubContext.eventAction})\n`;
  } else {
    systemPrompt += '\n';
  }
  systemPrompt += `- **Repository**: ${githubContext.repository.fullName}\n`;
  systemPrompt += `- **Run ID**: ${githubContext.runId}\n`;

  return systemPrompt;
}
```

### Step 6: Prepare for Execution

```typescript
// Entry: ModeOptions
const prepareResult = await modeInstance.prepare(options);

// Output: ModeResult
```

**ModeOptions**:

```typescript
interface ModeOptions {
  context: GitHubContext;
  octokit: Octokit;
}
```

**ModeResult**:

```typescript
interface ModeResult {
  commentId?: number;
  taskId: string;
  branchInfo: {
    baseBranch: string;
    claudeBranch?: string;
    currentBranch: string;
  };
  issueNumber?: number;
  shouldExecute: boolean;
  // Mode-specific fields...
}
```

**Per-Mode Preparation**:

#### Agent Mode

```typescript
async prepare(options: ModeOptions): Promise<ModeResult> {
  const { context, octokit } = options;
  const { owner, repo } = context.repository;

  console.log(`\n🤖 Agent Mode Preparation`);
  console.log(`  Repository: ${owner}/${repo}`);

  let commentId: number | undefined;
  const taskId = `agent-${owner}-${repo}-${Date.now()}`;

  // Create tracking comment
  if (context.entityNumber) {
    const progressComment = generateProgressComment({
      taskId,
      status: 'starting',
      message: '🤖 Starting agent task...',
    });

    const result = await CommentOps.createComment(octokit, {
      owner,
      repo,
      issueNumber: context.entityNumber,
      body: progressComment,
    });
    commentId = result.id;

    // Add "in-progress" label
    await LabelOps.addLabels(octokit, owner, repo, context.entityNumber, ['agent:working']);
  }

  const baseBranch = context.inputs.baseBranch || 'main';

  return {
    commentId,
    branchInfo: {
      baseBranch,
      claudeBranch: undefined,
      currentBranch: baseBranch,
    },
    taskId,
    issueNumber: context.entityNumber,
    shouldExecute: true,
  };
}
```

#### Tag Mode

```typescript
async prepare(options: ModeOptions): Promise<ModeResult> {
  const { context, octokit } = options;
  const { owner, repo } = context.repository;
  const entityNumber = context.entityNumber!;

  console.log('\n🏷️  Tag Mode Preparation');
  console.log(`  Repository: ${owner}/${repo}`);
  console.log(`  ${context.isPR ? 'PR' : 'Issue'}: #${entityNumber}`);

  // Find existing tracking comment
  const botName = context.inputs.botName || 'duyetbot[bot]';
  let existingComment = null;
  try {
    existingComment = await CommentOps.findBotComment(
      octokit,
      owner,
      repo,
      entityNumber,
      botName,
      PROGRESS_MARKER
    );
  } catch {
    // Ignore errors finding existing comment
  }

  let commentId: number | undefined;
  const taskId = `tag-${owner}-${repo}-${entityNumber}-${Date.now()}`;

  // Create or update tracking comment
  const progressComment = generateProgressComment({
    mode: 'tag',
    taskId,
    status: 'starting',
    message: '🤖 Initializing...',
  });

  if (existingComment) {
    await CommentOps.updateComment(octokit, {
      owner,
      repo,
      commentId: existingComment.id,
      body: progressComment,
    });
    commentId = existingComment.id;
  } else {
    const result = await CommentOps.createComment(octokit, {
      owner,
      repo,
      issueNumber: entityNumber,
      body: progressComment,
    });
    commentId = result.id;
  }

  // Add "in-progress" label
  await LabelOps.addLabels(octokit, owner, repo, entityNumber, ['agent:working']);

  const baseBranch = context.inputs.baseBranch || 'main';

  return {
    commentId,
    branchInfo: {
      baseBranch,
      claudeBranch: undefined,
      currentBranch: baseBranch,
    },
    taskId,
    issueNumber: entityNumber,
    shouldExecute: true,
  };
}
```

### Step 7: Execute Agent

```typescript
// Entry: User prompt + system prompt + tools
const result = await agent.run({
  prompt,
  systemPrompt,
  tools,
  // ...
});

// Output: AgentResult
```

**AgentResult**:

```typescript
interface AgentResult {
  success: boolean;
  output: string;
  error?: string;
  tokensUsed: number;
  stepsCompleted: number;
}
```

### Step 8: Build Report Context

```typescript
// Entry: Task + AgentResult + duration
const reportContext = buildReportContext(task, result, duration);

// Output: ReportContext
```

## Context Enrichment

### Tag Mode Context Enrichment

Tag mode enriches context with GitHub API data:

```typescript
async prepare(options: ModeOptions): Promise<ModeResult> {
  const { context, octokit } = options;
  const { owner, repo } = context.repository;
  const entityNumber = context.entityNumber!;

  // Get issue/PR data
  const issueData = await IssueOps.getIssue(octokit, { owner, repo, issueNumber: entityNumber });

  // Get comments
  const comments = await CommentOps.listComments(octokit, { owner, repo, issueNumber: entityNumber, per_page: 10 });

  // Get labels
  const labels = await LabelOps.getLabels(octokit, { owner, repo });

  // This data is used in generatePrompt() to provide rich context
}
```

### Agent Mode Context Enrichment

Agent mode uses issue content from GitHub context:

```typescript
generatePrompt(context: ModeContext): string {
  const { githubContext } = context;

  if (githubContext.eventName === 'issues' && githubContext.entityNumber) {
    const issue = githubContext.payload?.issue;
    prompt += `## Task\n\n`;
    prompt += `Process this issue:\n\n`;
    prompt += `**Title:** ${issue?.title}\n\n`;
    prompt += `**Body:**\n${issue?.body || '(No description)'}\n\n`;
  }
}
```

### Continuous Mode Context Enrichment

Continuous mode enriches with task picker:

```typescript
async prepare(options: ModeOptions): Promise<ModeResult> {
  const { context, octokit } = options;
  const { owner, repo } = context.repository;

  // Initialize task picker
  const taskSource = context.inputs.taskSource || 'github-issues';
  const maxTasks = parseInt(context.inputs.maxTasks || '100', 10);

  const picker = new TaskPicker({
    sources: [
      {
        type: taskSource,
        options: {
          repository: context.repository.fullName,
          owner,
          repo,
          octokit,
        },
      },
    ],
  });

  await picker.initialize();

  // Return tasks for processing
  return {
    taskId: `continuous-${owner}-${repo}-${Date.now()}`,
    shouldExecute: true,
    maxTasks,
  };
}
```

## System Prompt Structure

### Base System Prompt

All modes use a similar base system prompt structure:

```markdown
## GitHub Context

- **Actor**: {actor}
- **Event**: {eventName} ({eventAction})
- **Repository**: {owner}/{repo}
- **Run ID**: {runId}
```

### Mode-Specific System Prompts

**Agent Mode**:
- Basic GitHub context
- No mode-specific additions

**Tag Mode**:
- Basic GitHub context
- No mode-specific additions

**Continuous Mode**:
- Basic GitHub context
- Additional configuration:
  - Max Tasks: {maxTasks}
  - Delay Between Tasks: {delay}s
  - Auto-Merge: {autoMerge}
  - Close Issues: {closeIssues}

## User Prompt Structure

### Agent Mode

```markdown
You are duyetbot, an AI coding assistant.

## Task

{promptInput or issue content}

## Repository Context

- **Repository**: {owner}/{repo}
- **{Issue/PR}**: #{entityNumber}
- **URL**: {url}

## Instructions

1. Understand task and analyze codebase
2. Create a plan for implementation
3. Implement changes
4. Test and verify changes
5. Report results
```

### Tag Mode

```markdown
You are duyetbot, an AI coding assistant.

## Task

{request after @duyetbot mention}

## {Issue/PR} Context

- **Number**: #{entityNumber}
- **Repository**: {owner}/{repo}
- **URL**: {url}
- **Labels**: {labels}

## Instructions

1. Analyze request and codebase
2. Create a plan for changes needed
3. Implement changes on a new branch
4. Create a pull request with your changes
5. Add a summary comment when done

## Additional Context

{additional prompt input}
```

### Continuous Mode

```markdown
You are duyetbot, an AI coding assistant.

## Task

Process multiple tasks in continuous mode.

## Configuration

- **Max Tasks**: {maxTasks}
- **Task Source**: {taskSource}
- **Auto-Merge**: {autoMerge}
- **Close Issues**: {closeIssues}

## Current Task

Task {taskIndex} of {totalTasks}:

{currentTask.description}

## Instructions

1. Complete the current task
2. Create a pull request if needed
3. Wait for the next task
4. Repeat until max tasks reached or no more tasks

## Initial Context

{additional prompt input}
```

## Context Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                 1. Parse GitHub Context                     │
│                 (from env vars + event payload)               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │   Detect Mode       │
                   │   (agent/tag/continuous) │
                   └──────────┬─────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   Prepare Mode      │
                   │   Context          │
                   └──────────┬─────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   Generate Prompt   │
                   │   + System Prompt  │
                   └──────────┬─────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   Prepare GitHub   │
                   │   Environment     │
                   │   (comments,        │
                   │    labels, etc.)  │
                   └──────────┬─────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   Execute Agent    │
                   │   (chat loop)     │
                   └──────────┬─────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   Build Report     │
                   │   Context         │
                   └──────────┬─────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   Report Results  │
                   │   (GitHub, artifacts) │
                   └────────────────────────┘
```

## Key Findings

### Strengths

1. ✅ **Rich Context**: All modes get comprehensive context about repository, event, entity
2. ✅ **Mode-Specific**: Each mode has tailored prompts and instructions
3. ✅ **Enrichment**: Tag mode fetches additional GitHub data (comments, labels)
4. ✅ **Tracking**: All modes create tracking comments with progress
5. ✅ **Label Management**: All modes add/remove labels to indicate status
6. ✅ **System/User Separation**: Clear separation between system and user prompts
7. ✅ **Configurable**: Many aspects of context are configurable via inputs

### Weaknesses

1. ❌ **Hardcoded Prompts**: All prompts are hardcoded in TypeScript
2. ❌ **No Dynamic Enrichment**: Enrichment is manual, not automatic
3. ❌ **No Context Caching**: No caching of GitHub API calls
4. ❌ **No Context Filtering**: All GitHub data is included, no filtering
5. ❌ **No Context Limits**: No token or character limits on context
6. ❌ **No Context Prioritization**: All context treated equally
7. ❌ **No Context Compression**: Large contexts not compressed
8. ❌ **No Context Sharing**: No mechanism to share context between tasks

### Issues Identified

1. **Prompts Not Customizable**: Users cannot customize prompts without code changes
2. **No Context Profiles**: No way to define different context profiles per project
3. **No Context Precedence**: No way to prioritize certain context sources
4. **No Context Exclusion**: No way to exclude certain context sources
5. **Manual Enrichment**: Enrichment is hardcoded in prepare() methods

## Transformation Opportunities

### 1. Move Prompts to Skills

**Current**: Hardcoded in mode files (937 lines total)

**Target**: `.md` skill files with prompt templates

Benefits:
- Easier to customize prompts per project
- Can add new prompts without code changes
- Can version control prompts separately

### 2. Add Dynamic Context Enrichment

**Current**: Manual enrichment in prepare() methods

**Target**: Declarative enrichment configuration

Implement:
- Enrichment rules in `.md` files
- Automatic enrichment based on rules
- Cache enrichment results
- Configurable enrichment per mode

### 3. Add Context Profiles

**Current**: Single context profile for all modes

**Target**: Multiple context profiles per project

Implement:
- Profile configuration in `.md` files
- Profile selection via inputs
- Default profiles per mode
- Custom profiles per project

### 4. Add Context Filtering

**Current**: All context included

**Target**: Configurable context filtering

Implement:
- Filter rules in `.md` files
- Include/exclude patterns
- Context limits (tokens, characters)
- Priority-based context selection

### 5. Add Context Caching

**Current**: No caching

**Target**: Cache GitHub API calls

Implement:
- Cache for enrichment data
- TTL for cache entries
- Cache invalidation on updates
- Shared cache across tasks

## Next Steps

1. ✅ **Complete**: Document context types
2. ✅ **Complete**: Document context building pipeline
3. ✅ **Complete**: Document per-mode context preparation
4. ✅ **Complete**: Document prompt generation
5. ✅ **Complete**: Identify strengths and weaknesses
6. ✅ **Complete**: Identify transformation opportunities
7. ⏭️ **Next**: Begin gap analysis phase

## Conclusion

duyetbot-action uses a **sophisticated context building system** with:

- **4 context types**: GitHubContext, ModeContext, ExecutionContext, ReportContext
- **8-step pipeline**: Parse → Detect → Prepare → Generate Prompt → Prepare → Execute → Report
- **3 modes**: agent, tag, continuous
- **937 lines** of hardcoded mode context building logic
- **Direct Octokit usage**: ~25 calls in mode prepare() methods for context enrichment

**Key strengths**:
- Rich context with GitHub data
- Mode-specific prompts
- Tracking comments and labels
- System/user prompt separation

**Key weaknesses**:
- Hardcoded prompts
- Manual enrichment
- No caching
- No filtering or prioritization

**Transformation needs**:
- Move prompts to `.md` skills
- Add dynamic context enrichment
- Add context profiles
- Add context filtering
- Add context caching
