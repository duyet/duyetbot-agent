# Gap Analysis: Current vs Target State

## Overview

Comprehensive analysis of gaps between **current duyetbot-action state** and **desired target state** with skills, tasks, and sub-agents support.

## Target State Definition

### Desired Architecture

duyetbot-action should be a **generic, skill-based** system where:

- ✅ Logic is defined in **.md files** (skills/subagents)
- ✅ No hardcoded self-improvement logic in TypeScript
- ✅ No hardcoded mode prompts in TypeScript
- ✅ No direct Octokit API calls (all via github tool)
- ✅ Dynamic mode loading from skills
- ✅ Comprehensive retry logic for all operations
- ✅ Fix application for learned patterns
- ✅ Circuit breaker for repeated failures
- ✅ Dead letter queue for failed tasks
- ✅ Skill/subagent loader and registry
- ✅ All critical bugs fixed

### Key Metrics

| Metric | Current | Target | Gap |
|---------|----------|---------|------|
| Hardcoded Logic Lines | 5,867 | ~2,500 (in .md) | -3,367 (-57%) |
| Direct Octokit Calls | 94+ | 0 | -94 (-100%) |
| Missing GitHub Tool Actions | 16 | 0 | -16 (-100%) |
| Skill Files | 0 | 8+ (5 self-improvement + 3 modes) | +8 |
| Subagent Files | 0 | 5+ | +5 |
| Skills in .md | 0 | ~2,500 lines | +2,500 |
| Critical Bugs | 1 (assignee trigger) | 0 | -1 (-100%) |
| Retry Scope | Verification only | All operations | -limited → -comprehensive |
| Fix Application | TODO only | Full implementation | -TODO → -working |
| Circuit Breaker | None | Full implementation | -none → -working |
| Dead Letter Queue | None | Full implementation | -none → -working |

## Gap Categories

### Gap 1: Critical Bugs

**Severity**: CRITICAL  
**Impact**: HIGH - Core feature not working

| Bug | Location | Issue | Impact |
|-----|-----------|--------|--------|
| Missing assignee trigger | `src/modes/detector.ts` line 92, `src/modes/tag/index.ts` lines 25-30 | Documented but not implemented | @duyetbot assignments don't trigger bot |

**Root Cause**: Comment in code documents feature, but `shouldTrigger()` functions don't check `assignee` field

**Fix Required**:
```typescript
// In detector.ts line 92:
function checkForTrigger(context: GitHubContext): boolean {
  // ... existing checks ...

  // ADD THIS:
  // Check for assignee
  if (context.payload?.issue?.assignee?.login === 'duyetbot' ||
      context.payload?.pull_request?.assignee?.login === 'duyetbot') {
    return true;
  }

  // ... rest of checks ...
}

// In tag/index.ts shouldTrigger():
// Add same check
}
```

**Priority**: P0 (must fix before other work)  
**Effort**: LOW (30 minutes)  
**Dependencies**: None

---

### Gap 2: GitHub Tool Capabilities

**Severity**: HIGH  
**Impact**: HIGH - Cannot replace all Octokit calls

| Current | Target | Gap Count |
|---------|---------|------------|
| 31 actions | 47 actions | 16 missing (34% gap) |

#### Missing Actions by Priority

**Phase 1 - Critical** (BLOCKS transformation):

1. `delete_comment` - Delete a comment by ID
   - Usage: 10+ calls in operations/comments.ts, modes/*
   - Impact: Cannot delete tracking comments

2. `get_comment` - Get a specific comment by ID
   - Usage: 8+ calls in modes/agent/index.ts, modes/tag/index.ts
   - Impact: Cannot fetch comment for updates

3. `update_comment` - Update comment body
   - Usage: 5+ calls in modes/agent/index.ts, modes/tag/index.ts
   - Impact: Cannot update tracking comments with progress

4. `list_comments` - List all comments for issue/PR
   - Usage: 3 calls in operations/comments.ts
   - Impact: Cannot list comments for context

5. `merge_pull_request` - Merge a PR
   - Usage: 5+ calls in operations/pulls.ts
   - Impact: Cannot auto-merge PRs

6. `get_diff` - Get PR diff
   - Usage: 3 calls in operations/pulls.ts
   - Impact: Cannot get PR diff for analysis

7. `list_labels` - List all repository labels
   - Usage: 2 calls in operations/labels.ts
   - Impact: Cannot list labels for enrichment

8. `get_combined_status` - Get combined status check
   - Usage: 3 calls in operations/status.ts
   - Impact: Cannot monitor CI status

**Phase 2 - High Priority** (blocks some features):

9. `list_reviews` - List all reviews for PR
   - Usage: 2 calls in operations/pulls.ts

10. `review_pull_request` - Create a review
    - Usage: 2 calls in operations/pulls.ts

11. `create_status` - Create a status check
    - Usage: 2 calls in operations/status.ts

12. `update_status` - Update a status check
    - Usage: 2 calls in operations/status.ts

**Phase 3 - Medium Priority** (nice to have):

13. `get_review` - Get a specific review
    - Usage: 1 call in operations/pulls.ts

14. `delete_review` - Delete a review
    - Usage: 1 call in operations/pulls.ts

15. `get_workflow_runs` - List workflow runs
    - Usage: 1 call in operations/status.ts

**Phase 4 - Low Priority** (optional):

16. `trigger_workflow` - Trigger a workflow
    - Usage: Not used yet (future feature)

**Priority**: P1 (critical actions) → P2 (high priority)  
**Effort**: MEDIUM (4-8 hours total)  
**Dependencies**: None  
**File**: `packages/tools/src/github.ts`

---

### Gap 3: Direct Octokit Usage

**Severity**: HIGH  
**Impact**: HIGH - Cannot use unified tool interface, harder to test

| Module | Lines | Octokit Calls | Files |
|---------|--------|---------------|--------|
| comments.ts | 135 | 15 | operations/comments.ts |
| issues.ts | 193 | 10 | operations/issues.ts |
| pulls.ts | 341 | 15 | operations/pulls.ts |
| labels.ts | 97 | 8 | operations/labels.ts |
| branches.ts | 281 | 8 | operations/branches.ts |
| commits.ts | 311 | 10 | operations/commits.ts |
| tags.ts | 197 | 8 | operations/tags.ts |
| status.ts | 105 | 5 | operations/status.ts |
| modes/agent/index.ts | 265 | 5 | modes/agent/index.ts |
| modes/tag/index.ts | 318 | 10 | modes/tag/index.ts |
| modes/continuous/index.ts | 236 | 10 | modes/continuous/index.ts |
| **Total** | **2,489** | **94+** | **13 files** |

#### Current Pattern

```typescript
// Current: Direct Octokit calls
import { Octokit } from 'octokit';

const octokit = new Octokit({ auth: token });
const result = await octokit.rest.issues.createComment({
  owner,
  repo,
  issue_number: issueNumber,
  body: comment
});
```

#### Target Pattern

```typescript
// Target: Tool-based calls
import { github } from '@duyetbot/tools';

const result = await github({
  action: 'create_comment',
  params: {
    issue_number: issueNumber,
    body: comment
  }
});

if (!result.success) {
  throw new Error(`Failed to create comment: ${result.error}`);
}
```

#### Replacement Strategy

**Option A: Direct Replacement**
- Replace all Octokit calls with github tool calls
- Simpler, less code
- Consistent with skill-based approach

**Option B: Tool Wrapper**
- Create wrapper functions that use github tool internally
- Maintains existing API shape
- Easier migration
- Adds abstraction layer

**Recommended**: Option B (Tool Wrapper)

**Priority**: P1 (blocks skill-based architecture)  
**Effort**: HIGH (10-15 hours total)  
**Dependencies**: gap-2 (github tool extension)  
**Files**: 13 files to modify

---

### Gap 4: Hardcoded Self-Improvement Logic

**Severity**: HIGH  
**Impact**: MEDIUM - Can't add new error patterns without code changes

| Module | Lines | Purpose | Current | Target |
|---------|--------|---------|---------|--------|
| error-analyzer.ts | 284 | 10 error patterns in TS | 10 patterns in .md |
| failure-memory.ts | 387 | Learning in TS | Learning in .md |
| verification-loop.ts | 296 | 4 checks in TS | 4 checks in .md |
| auto-merge.ts | 218 | Auto-merge logic in TS | Auto-merge in .md |
| **Total** | **1,185** | 4 modules | 5 .md skills |

#### Current Structure

```typescript
// All logic hardcoded in TypeScript
export class ErrorAnalyzer {
  private readonly ERROR_PATTERNS = [
    { regex: /pattern/, category: 'type', severity: 'medium' },
    // ... 10 patterns
  ];

  parseError(message: string): ParsedError {
    // 200+ lines of parsing logic
  }
}

export class FailureMemory {
  // 387 lines of learning logic
}
```

#### Target Structure

```markdown
---
skill: error-analyzer
description: Parses and categorizes error messages
triggers:
  - error_detected
---

# Error Patterns

Define error patterns to match and categorize.

## Type Errors

```typescript
file.ts(line:col): error TSXXX: message
```

Category: type  
Severity: medium

## Test Failures

```typescript
FAIL <test name>
```

Category: test_failure  
Severity: medium

## Build Errors

```typescript
Error: Cannot find module '...'
```

Category: dependency  
Severity: high

# Parsing Logic

1. Match input against patterns in order
2. Extract structured data (file, line, column, code)
3. Assign category and severity
4. Return parsed error object
```

#### Skill Loader Required

```typescript
// Need to load .md files
interface Skill {
  name: string;
  description: string;
  triggers: string[];
  execute: (context: any) => Promise<any>;
}

class SkillLoader {
  async loadSkill(path: string): Promise<Skill> {
    const content = await readFile(path, 'utf-8');
    // Parse .md file
    // Extract skill metadata
    // Return Skill object
  }

  async loadAllSkills(dir: string): Promise<Skill[]> {
    const files = await readdir(dir);
    return Promise.all(
      files
        .filter(f => f.endsWith('.md'))
        .map(f => this.loadSkill(join(dir, f)))
    );
  }
}
```

**Priority**: P1 (core transformation goal)  
**Effort**: HIGH (8-12 hours total)  
**Dependencies**: gap-3 (skill loader)  
**Files**: 4 files to convert, 5 .md files to create

---

### Gap 5: Hardcoded Mode Logic

**Severity**: HIGH  
**Impact**: MEDIUM - Can't add new modes without code changes

| Mode | Lines | Features | Current | Target |
|------|--------|-----------|---------|--------|
| agent/index.ts | 265 | Direct automation | agent-mode.md |
| tag/index.ts | 318 | Interactive @duyetbot | tag-mode.md |
| continuous/index.ts | 236 | Multi-task processing | continuous-mode.md |
| **Total** | **819** | 3 modes | 3 .md skills |

#### Current Structure

```typescript
// All prompts and logic hardcoded in TypeScript
export const agentMode: Mode = {
  name: 'agent',
  description: 'Direct automation mode',
  shouldTrigger(context: GitHubContext): boolean {
    // Hardcoded trigger logic
  },
  generatePrompt(context: ModeContext): string {
    // Hardcoded prompt template
    let prompt = `You are duyetbot...`;
    prompt += `## Task\n\n${task}\n\n`;
    prompt += `## Instructions\n\n1. ...\n`;
    return prompt;
  },
  prepare(options: ModeOptions): Promise<ModeResult> {
    // Hardcoded preparation logic with direct Octokit calls
  }
};
```

#### Target Structure

```markdown
---
skill: agent-mode
description: Direct automation mode for explicit prompts
triggers:
  - workflow_dispatch
  - issue_opened
  - agent_task_label
---

# Agent Mode

## Trigger Conditions

This mode triggers when:
1. Explicit prompt input is provided
2. Workflow dispatch event with prompt
3. Issue is opened
4. Issue is labeled with "agent-task"

## User Prompt Template

```markdown
You are duyetbot, an AI coding assistant.

## Task

{taskInput or issueContent}

## Repository Context

- Repository: {owner}/{repo}
- {Issue/PR}: #{entityNumber}
- URL: {url}

## Instructions

1. Understand task and analyze codebase
2. Create a plan for implementation
3. Implement changes
4. Test and verify changes
5. Report results
```

## System Prompt Template

```markdown
## GitHub Context

- Actor: {actor}
- Event: {eventName} ({eventAction})
- Repository: {owner}/{repo}
- Run ID: {runId}
```

## Preparation

1. Create tracking comment (if entity exists)
2. Add "in-progress" label
3. Determine base branch
```

#### Mode Registry Required

```typescript
class ModeRegistry {
  private modes: Map<string, Mode> = new Map();

  async registerFromSkills(skills: Skill[]): Promise<void> {
    for (const skill of skills) {
      if (skill.isMode) {
        const mode = await this.buildModeFromSkill(skill);
        this.modes.set(skill.name, mode);
      }
    }
  }

  getMode(name: string): Mode {
    return this.modes.get(name);
  }

  getAllModes(): Mode[] {
    return Array.from(this.modes.values());
  }
}
```

**Priority**: P1 (core transformation goal)  
**Effort**: HIGH (6-10 hours total)  
**Dependencies**: gap-4 (skill loader)  
**Files**: 3 files to convert, 3 .md files to create

---

### Gap 6: Skill/Subagent System

**Severity**: HIGH  
**Impact**: MEDIUM - No skill loading infrastructure

**Current State**:
- ❌ No `.claude/skills/` directory
- ❌ No `.claude/subagents/` directory
- ❌ No skill loader
- ❌ No skill registry
- ❌ No subagent loader
- ❌ No subagent registry

**Target State**:
- ✅ `.claude/skills/` with 8 skills
- ✅ `.claude/subagents/` with 5 subagents
- ✅ Skill loader (reads .md files)
- ✅ Skill registry (manages skills)
- ✅ Subagent loader (reads .md files)
- ✅ Subagent registry (manages subagents)

#### Required Infrastructure

**1. Skill Loader**

```typescript
interface SkillMetadata {
  name: string;
  description: string;
  triggers: string[];
  type: 'self-improvement' | 'mode' | 'custom';
  version?: string;
  author?: string;
}

class SkillLoader {
  async load(path: string): Promise<Skill> {
    const content = await readFile(path, 'utf-8');
    const metadata = this.parseMetadata(content);
    const template = this.parseTemplate(content);
    return { metadata, template, content };
  }

  async loadAll(dir: string): Promise<Skill[]> {
    const files = await readdir(dir);
    const skills = await Promise.all(
      files
        .filter(f => f.endsWith('.md'))
        .map(f => this.load(join(dir, f)))
    );
    return skills;
  }

  private parseMetadata(content: string): SkillMetadata {
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatter) return { name: 'unknown', triggers: [] };
    return yaml.parse(frontmatter[1]);
  }
}
```

**2. Skill Registry**

```typescript
class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill): void {
    this.skills.set(skill.metadata.name, skill);
  }

  registerAll(skills: Skill[]): void {
    skills.forEach(s => this.register(s));
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  getByTrigger(trigger: string): Skill[] {
    return this.getAll().filter(s => s.metadata.triggers.includes(trigger));
  }
}
```

**3. Subagent Loader** (similar structure)
**4. Subagent Registry** (similar structure)

**Priority**: P1 (core infrastructure)  
**Effort**: MEDIUM (6-8 hours total)  
**Dependencies**: None  
**Files**: New files: `src/skills/loader.ts`, `src/skills/registry.ts`

---

### Gap 7: Context Building

**Severity**: MEDIUM  
**Impact**: LOW - Context is rich but hardcoded

| Aspect | Current | Target | Gap |
|--------|----------|---------|-----|
| Prompt Generation | Hardcoded in TS | In .md skills | 937 lines to move |
| Context Enrichment | Manual in prepare() | Declarative in .md | 819 lines to refactor |
| No Dynamic Profiles | Single profile | Multiple profiles | Missing feature |
| No Caching | No caching | Cache GitHub calls | Performance issue |
| No Filtering | All context included | Configurable filters | Token waste |
| No Prioritization | Equal priority | Priority-based | Context bloat |

#### Current Issues

```typescript
// All prompts hardcoded
generatePrompt(context: ModeContext): string {
  let prompt = `You are duyetbot...`;
  prompt += `## Task\n\n${task}\n\n`;
  prompt += `## Instructions\n\n1. ...\n`;
  // No way to customize without editing code
  return prompt;
}

// Manual enrichment
async prepare(options: ModeOptions): Promise<ModeResult> {
  // Fetch issue data
  const issue = await IssueOps.getIssue(octokit, { ... });
  // Fetch comments
  const comments = await CommentOps.listComments(octokit, { ... });
  // No caching, no filtering, no prioritization
}
```

#### Target Structure

```markdown
---
skill: agent-mode
profile: default
context-strategy:
  enrichment:
    - fetch_issue: true
    - fetch_comments: true
    - fetch_labels: true
    cache_ttl: 300000  # 5 minutes
  filtering:
    exclude_labels: ['wontfix', 'duplicate']
    max_comments: 10
  prioritization:
    recent_comments_first: true
    high_priority_labels: ['bug', 'critical']
---

# Context Building

## Enrichment Rules

1. Fetch issue if not already in context
2. Fetch last 10 comments (configurable)
3. Exclude labels: wontfix, duplicate
4. Cache for 5 minutes
5. Prioritize recent comments
```

**Priority**: P2 (improves efficiency)  
**Effort**: MEDIUM (4-6 hours)  
**Dependencies**: gap-6 (skill system)  
**Files**: 3 mode files to refactor

---

### Gap 8: Error Handling and Retry Logic

**Severity**: HIGH  
**Impact**: HIGH - Fragile operation, no resilience

| Operation | Current Retry | Target Retry | Gap |
|-----------|--------------|--------------|-----|
| LLM API calls | None (1 attempt) | 3 attempts with backoff | NO retry |
| GitHub API calls | None (1 attempt) | Rate limit aware, 3 attempts | NO retry |
| Tool execution | None (1 attempt) | 3 attempts | NO retry |
| Network errors | None (1 attempt) | 3 attempts | NO retry |
| Verification failures | 3 attempts | 3 attempts | ✓ OK |

#### Current State

```typescript
// No retry for LLM calls
const result = await llm.generate(prompt, { ... });
// If fails → immediate error

// No retry for GitHub API
const result = await octokit.rest.issues.createComment({ ... });
// If fails → immediate error

// No retry for tool execution
const result = await tool.execute({ ... });
// If fails → immediate error
```

#### Target State

```typescript
// Retry decorator
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    backoffMs: number;
    onRetry?: (attempt: number, error: Error) => void;
  }
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < options.maxAttempts) {
        options.onRetry?.(attempt, lastError);
        await sleep(options.backoffMs * attempt); // Exponential backoff
      }
    }
  }
  throw lastError;
}

// Usage
const result = await withRetry(
  () => llm.generate(prompt),
  {
    maxAttempts: 3,
    backoffMs: 1000,
    onRetry: (attempt, error) => console.log(`Retry ${attempt}: ${error.message}`)
  }
);
```

**Priority**: P1 (critical reliability)  
**Effort**: MEDIUM (4-6 hours)  
**Dependencies**: None  
**Files**: New file: `src/utils/retry.ts`, updates to existing files

---

### Gap 9: Fix Application

**Severity**: MEDIUM  
**Impact**: MEDIUM - Self-improvement incomplete

| Component | Current | Target | Gap |
|-----------|----------|---------|-----|
| Patch Application | TODO comment | Full implementation | NOOP → working |
| Command Execution | TODO comment | Full implementation | NOOP → working |
| Config Changes | TODO comment | Full implementation | NOOP → working |
| Rollback | None | Full implementation | Missing |

#### Current State

```typescript
// In self-improving-loop.ts line 208-220
private async applyFix(fix: FixSuggestion): Promise<boolean> {
  console.log(`   Applying fix: ${fix.description}`);

  // TODO: Implement actual fix application
  // For now, just return true to simulate fix
  // In Phase 2, this would:
  // - Apply patches for code changes
  // - Run commands for dependencies
  // - Modify configuration files

  return true; // Simulates fix for now
}
```

#### Target State

```typescript
private async applyFix(fix: FixSuggestion): Promise<boolean> {
  console.log(`   Applying fix: ${fix.description}`);

  try {
    // Apply patches
    if (fix.patch) {
      await this.applyPatch(fix.patch);
    }

    // Run commands
    if (fix.command) {
      await this.runCommand(fix.command);
    }

    // Verify fix
    await this.verifyFix(fix);

    // Rollback if failed
    return true;
  } catch (error) {
    console.error(`   ❌ Fix failed: ${error}`);
    await this.rollbackFix(fix);
    return false;
  }
}

private async applyPatch(patch: Patch): Promise<void> {
  const content = await readFile(patch.file, 'utf-8');
  const newContent = content.replace(patch.oldText, patch.newText);
  await writeFile(patch.file, newContent);
}

private async runCommand(command: Command): Promise<void> {
  const { stdout, stderr, exitCode } = await spawn(
    command.command,
    command.args,
    { cwd: command.cwd }
  );
  if (exitCode !== 0) {
    throw new Error(stderr || 'Command failed');
  }
}

private async rollbackFix(fix: FixSuggestion): Promise<void> {
  if (fix.patch) {
    const backup = await this.getBackup(fix.patch.file);
    await writeFile(fix.patch.file, backup);
  }
  // Rollback commands as needed
}
```

**Priority**: P2 (completes self-improvement)  
**Effort**: MEDIUM (4-6 hours)  
**Dependencies**: None  
**File**: `src/agent/self-improving-loop.ts`

---

### Gap 10: Circuit Breaker

**Severity**: MEDIUM  
**Impact**: LOW - No protection against cascading failures

**Current State**:
- ❌ No circuit breaker
- ❌ No failure rate tracking
- ❌ No automatic degradation

**Target State**:
- ✅ Circuit breaker state machine
- ✅ Failure rate tracking
- ✅ Auto-open after threshold
- ✅ Half-open for testing
- ✅ Auto-close after recovery

#### Implementation Required

```typescript
type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  constructor(
    private threshold: number,      // Failures to open circuit
    private timeout: number,        // Time to wait before half-open
    private successThreshold: number // Successes to close circuit
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we can try half-open
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.failureCount = 0;

    if (this.state === 'half-open' &&
        this.successCount >= this.successThreshold) {
      this.state = 'closed';
      this.successCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

**Priority**: P2 (improves reliability)  
**Effort**: MEDIUM (3-4 hours)  
**Dependencies**: None  
**File**: New file: `src/utils/circuit-breaker.ts`

---

### Gap 11: Dead Letter Queue

**Severity**: LOW  
**Impact**: LOW - No retry for failed tasks

**Current State**:
- ❌ No dead letter queue
- ❌ Failed tasks marked but not retried
- ❌ No exponential backoff
- ❌ No max retry limit

**Target State**:
- ✅ Dead letter queue implementation
- ✅ Exponential backoff for retries
- ✅ Max retry limit per task
- ✅ Manual retry mechanism

#### Implementation Required

```typescript
interface DeadLetterTask {
  taskId: string;
  task: Task;
  error: string;
  retryCount: number;
  nextRetryAt: number;
  lastAttemptAt: number;
}

class DeadLetterQueue {
  private queue: Map<string, DeadLetterTask> = new Map();
  private readonly maxRetries = 3;
  private readonly baseBackoffMs = 60000; // 1 minute

  async add(task: Task, error: string): Promise<void> {
    const dlqTask: DeadLetterTask = {
      taskId: task.id,
      task,
      error,
      retryCount: 0,
      nextRetryAt: Date.now() + this.calculateBackoff(0),
      lastAttemptAt: Date.now()
    };
    this.queue.set(task.id, dlqTask);
    await this.persistQueue();
  }

  async process(): Promise<void> {
    const now = Date.now();
    const readyTasks = Array.from(this.queue.values())
      .filter(t => t.nextRetryAt <= now && t.retryCount < this.maxRetries);

    for (const dlqTask of readyTasks) {
      try {
        // Retry the task
        await this.executeTask(dlqTask.task);

        // Remove from DLQ
        this.queue.delete(dlqTask.taskId);
      } catch (error) {
        // Increment retry count
        dlqTask.retryCount++;
        dlqTask.lastAttemptAt = Date.now();
        dlqTask.nextRetryAt = Date.now() + this.calculateBackoff(dlqTask.retryCount);

        if (dlqTask.retryCount >= this.maxRetries) {
          // Max retries reached, move to manual queue
          await this.moveToManual(dlqTask);
          this.queue.delete(dlqTask.taskId);
        }
      }
    }

    await this.persistQueue();
  }

  private calculateBackoff(attempt: number): number {
    return this.baseBackoffMs * Math.pow(2, attempt);
  }

  async manualRetry(taskId: string): Promise<void> {
    const task = this.queue.get(taskId);
    if (!task) {
      throw new Error('Task not in DLQ');
    }
    task.retryCount = 0;
    task.nextRetryAt = Date.now();
    await this.process();
  }
}
```

**Priority**: P3 (nice to have)  
**Effort**: MEDIUM (4-5 hours)  
**Dependencies**: None  
**File**: New file: `src/utils/dead-letter-queue.ts`

---

## Gap Prioritization Matrix

| Gap | Priority | Impact | Effort | Blocked By | Risk |
|------|----------|---------|------------|-------|
| Gap 1: Assignee trigger bug | P0 | HIGH | LOW | None | LOW |
| Gap 2: GitHub tool actions | P1 | HIGH | HIGH | None | LOW |
| Gap 3: Direct Octokit usage | P1 | HIGH | HIGH | Gap 2 | MEDIUM |
| Gap 4: Self-improvement logic | P1 | HIGH | HIGH | Gap 6 | MEDIUM |
| Gap 5: Mode logic | P1 | HIGH | MEDIUM | Gap 6 | MEDIUM |
| Gap 6: Skill system | P1 | MEDIUM | HIGH | None | MEDIUM |
| Gap 7: Context building | P2 | LOW | MEDIUM | Gap 6 | LOW |
| Gap 8: Retry logic | P1 | HIGH | MEDIUM | None | MEDIUM |
| Gap 9: Fix application | P2 | MEDIUM | MEDIUM | None | LOW |
| Gap 10: Circuit breaker | P2 | LOW | MEDIUM | None | LOW |
| Gap 11: Dead letter queue | P3 | LOW | MEDIUM | None | LOW |

**Execution Order**:
1. P0 (fix bug) → unblocks everything
2. P1 (critical gaps) → core transformation
3. P2 (improvements) → enhances system
4. P3 (optional) → nice to have

## Risk Assessment

### High Risk Items

1. **GitHub Tool Extension** (Gap 2)
   - Risk: Breaking existing tool API
   - Mitigation: Add new actions, don't modify existing ones
   - Rollback: Can revert if issues

2. **Direct Octokit Replacement** (Gap 3)
   - Risk: Breaking existing functionality
   - Mitigation: Comprehensive test suite
   - Rollback: Keep old operations as fallback

3. **Skill System Implementation** (Gap 6)
   - Risk: Skill loading errors
   - Mitigation: Validation, error handling
   - Rollback: Can disable and use old code

### Medium Risk Items

4. **Self-Improvement Logic Move** (Gap 4)
   - Risk: Logic conversion errors
   - Mitigation: Incremental migration
   - Rollback: Keep old code

5. **Mode Logic Move** (Gap 5)
   - Risk: Prompt template errors
   - Mitigation: Validation, testing
   - Rollback: Keep old modes

## Dependencies Graph

```
Gap 1 (Assignee Bug)
├─ No dependencies
└─ Unblocks: Nothing, but required for correctness

Gap 2 (GitHub Tool)
├─ No dependencies
└─ Unblocks: Gap 3 (Octokit Replacement)

Gap 3 (Octokit Replacement)
├─ Depends on: Gap 2 (GitHub Tool)
└─ Unblocks: Gap 4, Gap 5 (Logic Moves)

Gap 6 (Skill System)
├─ No dependencies
└─ Unblocks: Gap 4, Gap 5 (Logic Moves)

Gap 4 (Self-Improvement Logic)
├─ Depends on: Gap 6 (Skill System)
└─ Unblocks: Nothing

Gap 5 (Mode Logic)
├─ Depends on: Gap 6 (Skill System)
└─ Unblocks: Nothing

Gap 8 (Retry Logic)
├─ No dependencies
└─ Unblocks: Nothing

Gap 9 (Fix Application)
├─ No dependencies
└─ Unblocks: Nothing

Gap 10 (Circuit Breaker)
├─ No dependencies
└─ Unblocks: Nothing

Gap 11 (Dead Letter Queue)
├─ No dependencies
└─ Unblocks: Nothing
```

**Critical Path**:
Gap 2 → Gap 3 → Gap 4, Gap 5

**Parallelizable**:
- Gap 1 (can do anytime)
- Gap 6 (can do anytime)
- Gap 8 (can do anytime)
- Gap 9 (can do anytime)
- Gap 10 (can do anytime)
- Gap 11 (can do anytime)

## Success Metrics

Transformation will be considered **successful** when:

### Must Haves (P0, P1)

- [ ] Gap 1: Assignee trigger implemented and working
- [ ] Gap 2: 16 missing GitHub tool actions added
- [ ] Gap 3: 94+ Octokit calls replaced with tool wrapper
- [ ] Gap 4: 4 self-improvement modules moved to .md skills
- [ ] Gap 5: 3 mode modules moved to .md skills
- [ ] Gap 6: Skill/subagent loader and registry implemented
- [ ] Gap 8: Comprehensive retry logic implemented

### Should Haves (P2)

- [ ] Gap 7: Context enrichment improved (caching, filtering)
- [ ] Gap 9: Fix application fully implemented
- [ ] Gap 10: Circuit breaker implemented

### Nice to Haves (P3)

- [ ] Gap 11: Dead letter queue implemented

### Quality Gates

- [ ] All 606 existing tests still passing
- [ ] 173 new tests passing
- [ ] Code coverage > 90%
- [ ] No lint errors
- [ ] No type errors
- [ ] All documentation complete

## Next Steps

### Immediate (This Session)

1. ✅ Complete gap-1 (this document)
2. ⏭️ gap-2: Prioritize gaps by impact and effort
3. ⏭️ Move to architecture design phase

### Short Term (Next Session)

1. Design skill/subagent system (arch-1)
2. Design mode registry (arch-2)
3. Design context enrichment (arch-3)
4. Design error handling (arch-4)
5. Design retry/circuit breaker (arch-5)

### Medium Term

1. Implement critical fixes (fix-1, fix-2)
2. Extend github tool (github-tool-1 through 4)
3. Implement skill system (skills-1 through 14)
4. Replace Octokit calls (replace-octokit-1 through 10)

### Long Term

1. Implement retry logic (retry-1 through 5)
2. Implement fix application (fix-application-1 through 4)
3. Implement circuit breaker (circuit-breaker-1 through 3)
4. Implement DLQ (dlq-1 through 4)
5. Write comprehensive tests (test-1 through 50)
6. Write documentation (doc-1 through 10)
7. Deploy (deploy-1 through 6)

## Conclusion

**Summary of Gaps**:

- **11 major gaps** identified
- **P0 gaps**: 1 (critical bug)
- **P1 gaps**: 6 (core transformation)
- **P2 gaps**: 3 (improvements)
- **P3 gaps**: 1 (optional)

**Total Effort Estimate**:
- P0: 0.5 hours (assignee bug)
- P1: 32-42 hours (core transformation)
- P2: 14-18 hours (improvements)
- P3: 4-5 hours (optional)
- **Total**: **50-66 hours** (6-8 days)

**Key Dependencies**:
1. Gap 2 (GitHub tool) → unblocks Gap 3
2. Gap 6 (Skill system) → unblocks Gap 4, Gap 5
3. No other hard dependencies

**Critical Path**:
Gap 1 → Gap 2 → Gap 3 → (Gap 4, Gap 5 in parallel)

**Risk Level**: MEDIUM
- High complexity changes
- Multiple refactors in parallel
- Breaking changes to core systems

**Mitigation Strategy**:
1. Fix P0 bug first (unblocks nothing but critical)
2. Implement skill system before logic moves (foundation)
3. Extend github tool before Octokit replacement (dependency)
4. Incremental migration with feature flags
5. Comprehensive testing at each phase

**Next Action**: Complete gap-2 (prioritization matrix)
