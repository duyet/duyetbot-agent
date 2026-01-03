# Task Sources Analysis

## Overview

duyetbot-action has a flexible task source system that aggregates tasks from three different providers:
1. **GitHub Issues** - Issues labeled with `agent-task`
2. **File-based** - Tasks from `TASKS.md` markdown file
3. **Memory MCP** - Tasks from memory-mcp service (cross-session context)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Task Picker                            │
│                    (Aggregator)                             │
│                           │                                     │
│     ┌──────────────┬──────────────┬──────────────┐             │
│     │              │              │              │             │
│ GitHub           │   File Tasks  │   Memory MCP   │             │
│   Issues         │              │              │             │
│ (Priority: 3)    │ (Priority: 2)    │ (Priority: 1) │             │
│                  │              │              │             │
└──────────────────────┴──────────────┴──────────────┘             │
│                                                                │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                      Task Provider
                            │
                     ┌──────────────────┐
                     │ Unified Task   │
                     │    Interface   │
                     │                │
                     └──────────────────┘
                            │
                            ▼
                      Task Execution
```

## Task Sources

### 1. GitHub Issues Source (`src/tasks/sources/github-issues.ts`)

**Lines:** 168
**Priority:** 3 (High)
**Purpose:** Pull tasks from GitHub issues labeled with `agent-task`

**Implementation:**
```typescript
export class GitHubIssuesSource implements TaskSourceProvider {
  public readonly name = 'github-issues' as const;
  public readonly priority = 3;

  // Uses direct Octokit API calls:
  async listPending(): Promise<Task[]> {
    const { data: issues } = await this.octokit.issues.listForRepo({
      owner, repo, labels: 'agent-task', state: 'open',
      sort: 'created', direction: 'desc'
    });

    return issues.map(issue => this.issueToTask(issue));
  }

  // Task completion closes issue with comment:
  async markComplete(taskId: string): Promise<void> {
    await this.octokit.issues.createComment({...});
    await this.octokit.issues.update({... state: 'closed'});
  }
}
```

**Issues to Address:**
1. **Direct Octokit Usage**: Lines 47, 71-76, 95, 98, 102-103
2. **Should Use Tool**: All GitHub operations should use `github` tool

### 2. File-based Source (`src/tasks/sources/file-tasks.ts`)

**Lines:** 185
**Priority:** 2 (Medium)
**Purpose:** Parse tasks from `TASKS.md` markdown file with checkboxes

**Implementation:**
```typescript
export class FileTasksSource implements TaskSourceProvider {
  public readonly name = 'file' as const;
  public readonly priority = 2;

  // Parses markdown checkboxes:
  async listPending(): Promise<Task[]> {
    const content = await readFile(this.filePath, 'utf-8');
    const lines = content.split('\n');

    // Match unchecked checkbox: - [ ] or * [ ]
    const uncheckedMatch = line.match(/^[-*]\s+\[\s\]\s+(.+)$/);

    tasks.push(this.parseTaskLine(taskText, i));
  }

  // Marks checkbox as completed:
  async markComplete(taskId: string): Promise<void> {
    await this.updateTaskCheckbox(lineNumber, true);
  }
}
```

**Task Format:**
```markdown
- [ ] Task description
- [x] Completed task
- [ ] [P1] High priority task
- [ ] #label Another task
```

**Features:**
- Priority markers: `[P1]` through `[P10]` (1-10, lower is higher priority)
- Labels via hashtags: `#feature`, `#bug`, `#refactor`
- Tracks line numbers for updates

### 3. Memory MCP Source (`src/tasks/sources/memory-mcp.ts`)

**Lines:** 201
**Priority:** 1 (Low)
**Purpose:** Fetch tasks from memory-mcp service for cross-session context

**Implementation:**
```typescript
export class MemoryMcpSource implements TaskSourceProvider {
  public readonly name = 'memory' as const;
  public readonly priority = 1;

  // Uses HTTP API to memory-mcp service:
  async listPending(): Promise<Task[]> {
    const response = await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list',
        params: { status: 'pending', limit: 100 },
        userId: this.userId,
      }),
    });

    const data = (await response.json()) as { tasks?: MemoryTask[] };
    return tasks.map(task => this.memoryTaskToTask(task));
  }

  // Updates task status via HTTP API:
  async markComplete(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'complete',
        params: { id: taskId },
        userId: this.userId,
      }),
    });
  }

  // Fails task with error metadata:
  async markFailed(taskId: string, error: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'update',
        params: {
          id: taskId,
          status: 'cancelled',
          metadata: { error, failedAt: Date.now() },
        },
        userId: this.userId,
      }),
    });
  }
}
```

**Schema:**
```typescript
const memoryTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled']),
  priority: z.number().min(1).max(10),
  due_date: z.number().nullable(),
  completed_at: z.number().nullable(),
  parent_task_id: z.string().nullable(),
  tags: z.array(z.string()),
  created_at: z.number(),
  updated_at: z.number(),
  metadata: z.record(z.unknown()).nullable(),
});
```

**Features:**
- Task statuses: pending, in_progress, blocked, completed, cancelled
- Due dates
- Parent-child task relationships
- Tags for organization
- Rich metadata for custom data

### 4. Task Picker (`src/tasks/picker.ts`)

**Lines:** 219
**Purpose:** Aggregate tasks from all sources and provide unified interface

**Implementation:**
```typescript
export class TaskPicker {
  private sources: TaskSourceProvider[] = [];

  // Aggregate tasks from all sources in parallel:
  async pickNext(): Promise<Task | null> {
    const taskLists = await Promise.all(
      this.sources.map(source => source.listPending())
    );

    // Flatten and combine all tasks
    const allTasks: Array<Task & { sourcePriority: number }> = [];

    // Sort by:
    // 1. Source priority (descending: 3, 2, 1)
    // 2. Task priority (ascending: 1 is higher)
    // 3. Creation date (newer first)
    allTasks.sort((a, b) => {
      // Source priority first
      if (a.sourcePriority !== b.sourcePriority) {
        return b.sourcePriority - a.sourcePriority;
      }
      // Task priority number first (1 is higher priority than 10)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Newer tasks first
      return b.createdAt - a.createdAt;
    });

    return allTasks[0];
  }

  // Delegates to appropriate source:
  async markComplete(taskId: string): Promise<void> {
    const source = this.findSourceForTask(taskId);
    await source.markComplete(taskId);
  }

  async markFailed(taskId: string, error: string): Promise<void> {
    const source = this.findSourceForTask(taskId);
    await source.markFailed(taskId, error);
  }
}
```

**Features:**
- Parallel task fetching from all sources
- Prioritization by source + task priority
- Source-specific task management delegation

## Task Types (`src/tasks/types.ts`)

**Lines:** 99
**Purpose:** Unified interfaces for task system

**Key Types:**
```typescript
export type TaskSource = 'github-issues' | 'file' | 'memory';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  id: string;
  source: TaskSource;
  title: string;
  description: string;
  priority: number;  // 1-10, lower is higher priority
  labels: string[];
  status: TaskStatus;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface TaskSourceProvider {
  name: TaskSource;
  priority: number;

  listPending(): Promise<Task[]>;
  markComplete(taskId: string): Promise<void>;
  markFailed(taskId: string, error: string): Promise<void>;
}
```

## Integration with Modes

### Current Usage

Task sources are **used by modes** but not integrated with skills:

1. **Continuous Mode** - Uses task picker to get tasks
2. **Agent Mode** - Can process tasks from sources
3. **Tag Mode** - Doesn't use task sources directly

**Current Implementation:**
```typescript
// In continuous/index.ts:
import { TaskPicker } from '../../tasks/index.js';

const picker = new TaskPicker({
  sources: ['github-issues', 'file', 'memory'],
  githubToken: process.env.GITHUB_TOKEN,
  repository: { owner: 'user', name: 'repo' },
  tasksFilePath: './TASKS.md',
  memoryMcpUrl: 'https://memory.example.com',
});

const task = await picker.pickNext();
```

## Issues to Address

### 1. Direct API Usage (All Sources)

| Source | File | Lines | Direct API Calls | Should Use |
|--------|------|-------|------------------|------------|
| GitHub Issues | github-issues.ts | 168 | Octokit: issues.listForRepo, issues.createComment, issues.update | `github` tool |
| File | file-tasks.ts | 185 | node:fs readFile, writeFile (file ops OK) | N/A |
| Memory MCP | memory-mcp.ts | 201 | fetch: HTTP API calls | N/A |

**Direct Octokit to Replace:**
- Line 47: `await this.octokit.issues.listForRepo({...})`
- Line 71-76: `await this.octokit.issues.createComment({...})`
- Line 95, 102-103: `await this.octokit.issues.update({...})`

### 2. No Skill Integration

Task sources are currently **hardcoded implementations**:
- No skill triggers for different task types
- No dynamic loading of task sources
- No skill-based task processing

**Desired State:**
- Task sources defined as skills in `.claude/skills/`
- Skill metadata defines triggers (e.g., "github-issue", "file-task", "memory-task")
- Task picker loads skills dynamically
- Mode-specific behavior defined as skills

### 3. Limited Error Handling

Current error handling:
```typescript
try {
  // ... fetch tasks ...
} catch (error) {
  console.error('Error fetching GitHub issues:', error);
  return [];
}
```

**Issues:**
- Generic error logging
- No retry logic
- No exponential backoff
- No rate limit handling

## Transformation to Skill-Based System

### Proposed Task Source Skills

```markdown
# github-issue-source

## Triggers
- Task mentions "issue", "github", "agent-task"
- Continuous mode task processing

## Subagent
```typescript
{
  name: 'github_issue_source',
  description: 'Fetch tasks from GitHub issues with agent-task label',
  tools: ['github', 'read'],
  prompt: `You are a task source provider. Your role is to:
  1. Fetch issues from GitHub repository
  2. Filter for 'agent-task' label and open status
  3. Return tasks in unified format
  4. Mark tasks as complete by adding comments and closing issues
  5. Use github tool for all GitHub operations
  `,
}
```

```markdown
# file-task-source

## Triggers
- Task mentions "file", "markdown", "TASKS"
- Local task file processing

## Instructions
1. Read TASKS.md file
2. Parse markdown checkboxes
3. Return pending tasks
4. Update checkboxes on completion/failure
```

```markdown
# memory-task-source

## Triggers
- Task mentions "memory", "mcp", "context"
- Cross-session task processing

## Instructions
1. Query memory-mcp API for pending tasks
2. Return tasks with metadata
3. Update task status via API
```

## Summary

| Metric | Current | After Transformation |
|--------|---------|-------------------|
| Total Lines | 652 | ~500 (skill-based) |
| Sources | 3 hardcoded | 3 skill files |
| Direct Octokit | 7+ calls | 0 (all via tool) |
| Skill Integration | ❌ None | ✅ Full integration |
| Priority System | Hardcoded per source | Skill metadata |
| Error Handling | Basic | Advanced (via tools) |
| Extensibility | Low | High (add .md skill files) |

## Conclusion

The task source system is well-architected but **uses direct API calls** and **lacks skill integration**. The transformation should:

1. ✅ Replace all Octokit calls with `github` tool usage
2. ✅ Convert each source to a skill/subagent definition
3. ✅ Add skill triggers for dynamic loading
4. ✅ Improve error handling with tool-based retry logic
5. ✅ Make the system fully generic and extensible

**Next Steps:**
- Design skill metadata format for task sources
- Create skill files for each source
- Implement skill loader/registry for task sources
- Update modes to use skill-based task sources
- Add comprehensive testing for skill-based task system
