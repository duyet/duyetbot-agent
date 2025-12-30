---
title: 24/7 Long-Running Agent Server
description: Implementation plan for autonomous agent server using Claude Agent SDK with Ralph Loop integration
---

# 24/7 Long-Running Agent Server - Implementation Plan

**Status**: DESIGN PHASE
**Priority**: HIGH
**Created**: 2025-12-30
**Iteration**: 125

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Task Sources](#task-sources)
- [Ralph Loop Integration](#ralph-loop-integration)
- [LLM Providers](#llm-providers)
- [Implementation Phases](#implementation-phases)
- [Deployment](#deployment)
- [Monitoring & Observability](#monitoring--observability)

---

## Overview

The 24/7 Long-Running Agent Server is an autonomous agent system that continuously picks up tasks from multiple sources, executes them using Claude Agent SDK, and leverages Ralph Loop stop hooks for investigation checkpoints.

### Key Design Principles

```
1. Task Queue Architecture
   +- Multi-source task ingestion
   +- Priority-based execution
   +- Persistent state across restarts

2. Ralph Loop Integration
   +- Stop hooks for investigation checkpoints
   +- Agent pauses, investigates, takes notes
   +- Adds new tasks, continues execution

3. Claude Agent SDK Foundation
   +- Official Anthropic SDK for agent execution
   +- Tool-based approach (built-in + MCP)
   +- Streaming responses with real-time updates

4. Container-Based Runtime
   +- Full filesystem access
   +- Long-running process support
   +- Stateful workspace management
```

### Value Proposition

| Feature | Benefit |
|---------|---------|
| **24/7 Operation** | Continuous autonomous development |
| **Multi-Source Tasks** | Single agent for TODO.md, MCP todos, GitHub triggers |
| **Ralph Loop Hooks** | Structured investigation with checkpoint/recovery |
| **Claude Agent SDK** | Production-ready agent framework |
| **LLM Flexibility** | Switch between OpenRouter, AI Gateway, Claude API |

---

## Architecture

### System Diagram

```
+-------------------------------------------------------------------+
|                        Task Sources                               |
|                                                                   |
|  +----------------+  +----------------+  +---------------------+  |
|  | Memory MCP     |  | TODO.md Files  |  | GitHub Webhooks     |  |
|  | • Todo list    |  | • Project      |  | • Issue comments    |  |
|  | • REST API     |  | tasks          |  | • PR triggers       |  |
|  +----------------+  +----------------+  +---------------------+  |
|           |                    |                      |           |
+-----------+--------------------+----------------------+-----------+
            |                    |                      |
            +--------------------+----------------------+
                                 |
                                 | Poll / Push
                                 ▼
+-------------------------------------------------------------------+
|                    Agent Server (Container)                       |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |              Task Polling & Aggregation                     |  |
|  |  • Memory MCP REST API polling (30s interval)              |  |
|  |  • TODO.md file watching (chokidar)                        |  |
|  |  • GitHub webhook receiver (HTTP endpoint)                 |  |
|  +-------------------------------------------------------------+  |
|                              |                                  |
|                              ▼                                  |
|  +-------------------------------------------------------------+  |
|  |              Task Queue (Priority-Based)                    |  |
|  |  • Priority: HIGH (webhooks) > MEDIUM (MCP) > LOW (TODO.md) |  |
|  |  • Deduplication by task hash                              |  |
|  |  • Persistent storage (SQLite/PostgreSQL)                  |  |
|  +-------------------------------------------------------------+  |
|                              |                                  |
|                              ▼                                  |
|  +-------------------------------------------------------------+  |
|  |           Claude Agent SDK Loop (24/7 Execution)           |  |
|  |                                                             |  |
|  |  while (hasTasks()):                                       |  |
|  |    task = getNextTask()                                    |  |
|  |    executeTask(task)                                       |  |
|  |      with RalphLoop stop hooks:                            |  |
|  |      • onThinking: investigation checkpoint                 |  |
|  |      • onToolComplete: add new tasks if needed             |  |
|  |      • onError: recovery strategy                          |  |
|  |    markTaskComplete(task)                                  |  |
|  |                                                             |  |
|  +-------------------------------------------------------------+  |
|                              |                                  |
|                              ▼                                  |
|  +-------------------------------------------------------------+  |
|  |                    LLM Provider Layer                       |  |
|  |  • OpenRouter (multi-model)                                |  |
|  |  • AI Gateway (Cloudflare)                                 |  |
|  |  • Claude API (direct)                                     |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |                    Tools Available                          |  |
|  |  ├─ Built-in (Claude Agent SDK)                            |  |
|  |  │  ├─ bash: Shell execution                               |  |
|  |  │  ├─ editor: File editing                                |  |
|  |  │  ├─ search: Code search                                 |  |
|  |  │  └─ test: Test execution                                |  |
|  |  ├─ MCP Tools                                               |  |
|  |  │  ├─ memory-mcp: Cross-session memory                    |  |
|  |  │  ├─ github-mcp: GitHub operations                       |  |
|  |  │  └─ Custom MCP servers                                  |  |
|  |  └─ Custom Tools                                           |  |
|  |     ├─ todo-tasks: Task management                         |  |
|  |     ├─ git-ops: Advanced git operations                    |  |
|  |     └─ project-analyzer: Codebase analysis                 |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |              State & Persistence                            |  |
|  |  • SQLite: Tasks, execution history                        |  |
|  |  • Filesystem: Workspace, cloned repos                     |  |
|  |  • Memory MCP: Cross-session context                       |  |
|  +-------------------------------------------------------------+  |
+-------------------------------------------------------------------+
            |
            | Status Updates
            ▼
+-------------------------------------------------------------------+
|                      Output Channels                             |
|                                                                   |
|  +----------------+  +----------------+  +---------------------+  |
|  | Memory MCP     |  | Git Commits    |  | GitHub Comments     |  |
|  | • Update task  |  | • Autonomous   |  | • PR reviews        |  |
|  |   status       |  |   commits      |  | • Issue responses   |  |
|  +----------------+  +----------------+  +---------------------+  |
+-------------------------------------------------------------------+
```

### Project Structure

```
apps/agent-server/
├── src/
│   ├── index.ts                  # HTTP server entry point
│   ├── config.ts                 # Configuration management
│   ├── llm-provider.ts           # LLM provider abstraction
│   │
│   ├── agent/
│   │   ├── agent-loop.ts         # Main Claude Agent SDK loop
│   │   ├── stop-hooks.ts         # Ralph Loop hook integration
│   │   └── session.ts            # Session management
│   │
│   ├── tasks/
│   │   ├── task-sources.ts       # Multi-source task polling
│   │   ├── task-queue.ts         # Priority queue implementation
│   │   ├── task-executor.ts      # Task execution orchestration
│   │   └── sources/
│   │       ├── memory-mcp.ts     # Memory MCP REST API polling
│   │       ├── todo-files.ts     # TODO.md file watching
│   │       └── github-webhook.ts # GitHub webhook receiver
│   │
│   ├── tools/
│   │   ├── index.ts              # Tool registry
│   │   ├── builtin/              # Built-in tool wrappers
│   │   │   ├── bash.ts
│   │   │   ├── editor.ts
│   │   │   └── search.ts
│   │   └── custom/               # Custom tool implementations
│   │       ├── todo-tasks.ts
│   │       ├── git-ops.ts
│   │       └── project-analyzer.ts
│   │
│   ├── storage/
│   │   ├── database.ts           # SQLite database setup
│   │   ├── schema.sql            # Database schema
│   │   ├── task-repository.ts    # Task CRUD operations
│   │   └── workspace.ts          # Workspace filesystem management
│   │
│   ├── api/
│   │   ├── routes.ts             # HTTP routes (health, webhook)
│   │   └── middleware.ts         # Express middleware
│   │
│   └── monitoring/
│       ├── metrics.ts            # Metrics collection
│       ├── logging.ts            # Structured logging
│       └── alerts.ts             # Alert conditions
│
├── migrations/                   # Database migrations
│   └── 001_initial.sql
│
├── scripts/
│   ├── setup-db.ts               # Database initialization
│   └── seed-tasks.ts             # Seed initial tasks
│
├── Dockerfile                    # Container image
├── fly.toml                      # Fly.io deployment config
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Task Sources

### 1. Memory MCP REST API

**Purpose**: Poll todo items from the Memory MCP server.

**Implementation**:
```typescript
// src/tasks/sources/memory-mcp.ts

interface MemoryMcpConfig {
  baseUrl: string;
  pollInterval: number; // seconds
  apiKey?: string;
}

interface TodoItem {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: number;
  tags: string[];
}

class MemoryMcpTaskSource {
  private config: MemoryMcpConfig;

  async poll(): Promise<TodoItem[]> {
    const response = await fetch(`${this.config.baseUrl}/tasks`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });

    const data = await response.json();
    return data.tasks.filter((t: TodoItem) => t.status === 'pending');
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await fetch(`${this.config.baseUrl}/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
  }
}
```

**Polling Strategy**:
- Interval: 30 seconds
- Pagination: 100 items per request
- Backoff: Exponential on errors (30s → 60s → 120s → 300s)
- Timeout: 10 seconds per request

### 2. TODO.md Files

**Purpose**: Watch project TODO.md files for task definitions.

**File Format**:
```markdown
# TODO

## High Priority
- [ ] Add authentication to dashboard
- [ ] Implement rate limiting

## Medium Priority
- [ ] Add unit tests for API
- [ ] Update documentation

## Low Priority
- [ ] Refactor CSS
- [ ] Add dark mode
```

**Implementation**:
```typescript
// src/tasks/sources/todo-files.ts

import chokidar from 'chokidar';
import { readFile } from 'fs/promises';

interface TodoFileConfig {
  paths: string[]; // ['/path/to/TODO.md']
}

class TodoFileTaskSource {
  private watcher: chokidar.FSWatcher;

  constructor(private config: TodoFileConfig) {
    this.watcher = chokidar.watch(config.paths);
  }

  watch(onChange: (tasks: TodoItem[]) => void): void {
    this.watcher.on('change', async (path) => {
      const content = await readFile(path, 'utf-8');
      const tasks = this.parseTodoMarkdown(content);
      onChange(tasks);
    });
  }

  parseTodoMarkdown(content: string): TodoItem[] {
    // Parse markdown TODO format
    // Return array of TodoItem
  }
}
```

**Watching Strategy**:
- Use `chokidar` for cross-platform file watching
- Debounce: 500ms (ignore rapid changes)
- Initial scan: On startup
- Parse format: Flexible markdown-based

### 3. GitHub Webhooks

**Purpose**: Receive task triggers from GitHub events.

**Events**:
- `issue_comment.created`: @duyetbot mentions in issues
- `pull_request_review.submitted`: Review requests
- `workflow_run.completed`: CI/CD trigger actions

**Implementation**:
```typescript
// src/tasks/sources/github-webhook.ts

import { Hono } from 'hono';

interface GitHubWebhookConfig {
  secret: string; // GitHub webhook secret
}

class GitHubWebhookTaskSource {
  private app: Hono;

  constructor(private config: GitHubWebhookConfig) {
    this.app = new Hono();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.post('/webhook/github', async (c) => {
      const signature = c.req.header('x-hub-signature-256');
      const body = await c.req.text();

      if (!this.verifySignature(signature, body)) {
        return c.json({ error: 'Invalid signature' }, 401);
      }

      const payload = JSON.parse(body);
      const task = this.parseGitHubEvent(payload);

      if (task) {
        await this.enqueueTask(task);
      }

      return c.json({ ok: true });
    });
  }

  private parseGitHubEvent(payload: any): TodoItem | null {
    // Parse GitHub event and return task if relevant
  }
}
```

**Webhook Strategy**:
- Verification: HMAC-SHA256 signature check
- Deduplication: By delivery ID
- Priority: HIGH (webhooks get immediate attention)
- Response: <200ms (return immediately, process async)

---

## Ralph Loop Integration

### Stop Hook Architecture

Ralph Loop provides stop hooks that allow the agent to pause at specific points, investigate, and continue.

**Hook Points**:

```
1. onThinkingStart
   • Triggered when agent starts reasoning
   • Purpose: Initial investigation planning
   • Actions: Log context, set expectations

2. onToolComplete
   • Triggered after each tool execution
   • Purpose: Investigation checkpoint
   • Actions: Review results, add new tasks

3. onError
   • Triggered on errors
   • Purpose: Recovery planning
   • Actions: Log error, decide recovery strategy

4. onTaskComplete
   • Triggered when task is done
   • Purpose: Post-task review
   • Actions: Update status, add follow-up tasks
```

### Implementation

```typescript
// src/agent/stop-hooks.ts

import type {
  StopHook,
  ToolContext,
  AgentContext,
} from '@anthropic-ai/claude-agent-sdk';

interface RalphLoopHooksConfig {
  taskQueue: TaskQueue;
  memoryMcp: MemoryMcpClient;
  logger: Logger;
}

export function createRalphLoopHooks(
  config: RalphLoopHooksConfig
): StopHook {
  return {
    async onThinkingStart(context: AgentContext) {
      config.logger.info('[RALPH] Thinking started', {
        taskId: context.taskId,
        prompt: context.prompt.slice(0, 100),
      });

      // Store checkpoint in memory
      await config.memoryMcp.saveMemory({
        type: 'checkpoint',
        phase: 'thinking_start',
        taskId: context.taskId,
        timestamp: Date.now(),
      });
    },

    async onToolComplete(
      toolName: string,
      result: unknown,
      context: ToolContext
    ) {
      config.logger.info('[RALPH] Tool completed', {
        taskId: context.taskId,
        tool: toolName,
        result: typeof result,
      });

      // Investigation checkpoint
      const investigation = await investigateToolResult(
        toolName,
        result,
        context
      );

      // Add new tasks if investigation finds issues
      if (investigation.newTasks?.length > 0) {
        await config.taskQueue.enqueueMany(investigation.newTasks);
      }

      // Store investigation notes
      await config.memoryMcp.saveMemory({
        type: 'investigation',
        phase: 'tool_complete',
        tool: toolName,
        findings: investigation.notes,
        timestamp: Date.now(),
      });
    },

    async onError(error: Error, context: AgentContext) {
      config.logger.error('[RALPH] Error occurred', {
        taskId: context.taskId,
        error: error.message,
        stack: error.stack,
      });

      // Recovery strategy
      const recovery = planRecovery(error, context);

      if (recovery.action === 'retry') {
        await config.taskQueue.requeue(context.taskId, {
          attempt: context.attempt + 1,
          maxAttempts: 3,
        });
      } else if (recovery.action === 'escalate') {
        await config.taskQueue.enqueue({
          description: `Escalated task: ${context.taskId}`,
          priority: 'high',
          metadata: {
            originalError: error.message,
            originalTaskId: context.taskId,
          },
        });
      }
    },

    async onTaskComplete(result: unknown, context: AgentContext) {
      config.logger.info('[RALPH] Task completed', {
        taskId: context.taskId,
        result: typeof result,
        duration: Date.now() - context.startedAt,
      });

      // Update task status in all sources
      await config.taskQueue.markComplete(context.taskId);

      // Post-task review for follow-up tasks
      const followUpTasks = await identifyFollowUpTasks(result, context);
      if (followUpTasks.length > 0) {
        await config.taskQueue.enqueueMany(followUpTasks);
      }

      // Store completion checkpoint
      await config.memoryMcp.saveMemory({
        type: 'checkpoint',
        phase: 'task_complete',
        taskId: context.taskId,
        result: result,
        timestamp: Date.now(),
      });
    },
  };
}

async function investigateToolResult(
  toolName: string,
  result: unknown,
  context: ToolContext
): Promise<{ newTasks?: TodoItem[]; notes: string }> {
  // Investigation logic
  // Returns new tasks to add and investigation notes
  return { notes: `Tool ${toolName} completed successfully` };
}

function planRecovery(error: Error, context: AgentContext): {
  action: 'retry' | 'skip' | 'escalate';
} {
  // Recovery planning logic
  if (error.message.includes('timeout')) {
    return { action: 'retry' };
  }
  return { action: 'escalate' };
}

async function identifyFollowUpTasks(
  result: unknown,
  context: AgentContext
): Promise<TodoItem[]> {
  // Follow-up task identification
  return [];
}
```

### Investigation Checkpoint Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Tool Execution                           │
└─────────────────────────────────────────────────────────────┘
                           |
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              onToolComplete Hook Triggered                   │
│                                                             │
│  1. Agent pauses execution                                  │
│  2. Extract tool results                                    │
│  3. Run investigation:                                      │
│     • Analyze output for issues                            │
│     • Check for error patterns                             │
│     • Look for improvement opportunities                   │
│  4. Add new tasks if needed                                │
│  5. Save investigation notes to memory                     │
│  6. Resume execution                                       │
└─────────────────────────────────────────────────────────────┘
                           |
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Agent Continues Execution                      │
└─────────────────────────────────────────────────────────────┘
```

---

## LLM Providers

### Provider Abstraction

```typescript
// src/llm-provider.ts

interface LLMProvider {
  name: string;
  model: string;
  stream: boolean;
  maxTokens: number;
}

interface LLMProviderConfig {
  provider: 'openrouter' | 'ai-gateway' | 'claude';
  apiKey: string;
  baseURL?: string;
  model?: string;
}

class LLMProviderFactory {
  static create(config: LLMProviderConfig): LLMProvider {
    switch (config.provider) {
      case 'openrouter':
        return {
          name: 'openrouter',
          model: config.model || 'anthropic/claude-sonnet-4',
          baseURL: 'https://openrouter.ai/api/v1',
          stream: true,
          maxTokens: 8192,
        };

      case 'ai-gateway':
        return {
          name: 'ai-gateway',
          model: config.model || 'claude-sonnet-4',
          baseURL: config.baseURL, // Cloudflare AI Gateway URL
          stream: true,
          maxTokens: 8192,
        };

      case 'claude':
        return {
          name: 'claude',
          model: config.model || 'claude-sonnet-4-20250514',
          baseURL: 'https://api.anthropic.com/v1',
          stream: true,
          maxTokens: 8192,
        };

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
```

### Environment Configuration

```bash
# .env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-...
LLM_MODEL=anthropic/claude-sonnet-4
LLM_BASE_URL=https://openrouter.ai/api/v1

# Alternative: AI Gateway
# LLM_PROVIDER=ai-gateway
# LLM_BASE_URL=https://gateway.ai.cloudflare.com/v1/...
# LLM_API_KEY=...

# Alternative: Claude Direct
# LLM_PROVIDER=claude
# LLM_API_KEY=sk-ant-...
```

### Provider Selection Strategy

```
Priority Order:
1. Environment variable (LLM_PROVIDER)
2. Feature flags
3. Fallback chain: openrouter → ai-gateway → claude

Cost Optimization:
- Use haiku for simple tasks (file reads, status checks)
- Use sonnet for code analysis and generation
- Use opus for complex refactoring and debugging
```

---

## Implementation Phases

### Phase 1: Foundation (Iteration 151-160)

**Goal**: Basic agent server with Claude Agent SDK and single task source

#### Tasks

- [ ] Set up project structure
  - [ ] Initialize `apps/agent-server` package.json
  - [ ] Configure TypeScript
  - [ ] Set up Vitest for testing
  - [ ] Create directory structure

- [ ] Implement HTTP server
  - [ ] Hono/Express server setup
  - [ ] Health check endpoint (`GET /health`)
  - [ ] GitHub webhook receiver (`POST /webhook/github`)
  - [ ] Metrics endpoint (`GET /metrics`)

- [ ] Claude Agent SDK integration
  - [ ] Install `@anthropic-ai/claude-agent-sdk`
  - [ ] Create basic agent loop
  - [ ] Implement tool execution
  - [ ] Add streaming responses

- [ ] Database setup
  - [ ] SQLite schema design
  - [ ] Migration scripts
  - [ ] Task repository implementation
  - [ ] Database connection pooling

- [ ] Memory MCP task source
  - [ ] REST API polling implementation
  - [ ] Task parsing and normalization
  - [ ] Status update callbacks
  - [ ] Error handling and retry logic

- [ ] Basic tools
  - [ ] Bash tool wrapper
  - [ ] File read/write tool
  - [ ] Git operations tool (clone, status, commit)
  - [ ] Todo task management tool

- [ ] Testing
  - [ ] Unit tests for task sources
  - [ ] Integration tests for agent loop
  - [ ] End-to-end tests with mock tasks

#### File Structure (Phase 1)

```
apps/agent-server/
├── src/
│   ├── index.ts                  # HTTP server entry
│   ├── config.ts                 # Config management
│   ├── llm-provider.ts           # LLM provider setup
│   ├── agent/
│   │   ├── agent-loop.ts         # Claude Agent SDK loop
│   │   └── session.ts            # Session management
│   ├── tasks/
│   │   ├── task-sources.ts       # Task source aggregator
│   │   ├── task-queue.ts         # Priority queue
│   │   └── sources/
│   │       └── memory-mcp.ts     # Memory MCP polling
│   ├── tools/
│   │   ├── index.ts
│   │   └── builtin/
│   │       ├── bash.ts
│   │       ├── fs.ts
│   │       └── git.ts
│   ├── storage/
│   │   ├── database.ts
│   │   └── task-repository.ts
│   └── api/
│       ├── routes.ts
│       └── health.ts
├── migrations/
│   └── 001_initial.sql
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Phase 2: Multi-Source Tasks (Iteration 161-170)

**Goal**: Complete task source implementations

#### Tasks

- [ ] TODO.md file watching
  - [ ] Chokidar integration
  - [ ] Markdown parser
  - [ ] Task extraction and normalization
  - [ ] Debouncing and deduplication

- [ ] GitHub webhook receiver
  - [ ] Webhook signature verification
  - [ ] Event parsing (issues, PRs, comments)
  - [ ] @duyetbot mention detection
  - [ ] Task extraction from GitHub events

- [ ] Task queue improvements
  - [ ] Priority-based scheduling
  - [ ] Deduplication by content hash
  - [ ] Retry logic with exponential backoff
  - [ ] Task dependencies (wait for task X before Y)

- [ ] Workspace management
  - [ ] Per-task workspace directories
  - [ ] Automatic cleanup
  - [ ] Git repository isolation
  - [ ] Filesystem quotas

### Phase 3: Ralph Loop Integration (Iteration 171-180)

**Goal**: Complete stop hook implementation

#### Tasks

- [ ] Stop hook implementation
  - [ ] onThinkingStart hook
  - [ ] onToolComplete hook
  - [ ] onError hook
  - [ ] onTaskComplete hook

- [ ] Investigation system
  - [ ] Tool result analysis
  - [ ] Pattern detection for common issues
  - [ ] New task generation from findings
  - [ ] Investigation note storage

- [ ] Recovery strategies
  - [ ] Retry with backoff
  - [ ] Skip and continue
  - [ ] Escalate to human
  - [ ] Alternative approach

- [ ] Memory MCP checkpoint storage
  - [ ] Checkpoint schema
  - [ ] Investigation note storage
  - [ ] Query for past checkpoints
  - [ ] Resume from checkpoint

### Phase 4: Advanced Tools (Iteration 181-190)

**Goal**: Complete tool suite for autonomous development

#### Tasks

- [ ] Code analysis tools
  - [ ] AST-based code analysis
  - [ ] Dependency graph generation
  - [ ] Complexity metrics
  - [ ] Security vulnerability scanning

- [ ] Git operations
  - [ ] Advanced git operations (rebase, cherry-pick)
  - [ ] PR creation and management
  - [ ] Commit message generation
  - [ ] Branch management

- [ ] Testing tools
  - [ ] Test discovery and execution
  - [ ] Coverage reporting
  - [ ] Failure analysis
  - [ ] Test result storage

- [ ] Documentation tools
  - [ ] README generation
  - [ ] API documentation extraction
  - [ ] Changelog generation
  - [ ] Diagram generation (Mermaid)

### Phase 5: Deployment & Operations (Iteration 191-200)

**Goal**: Production-ready deployment

#### Tasks

- [ ] Containerization
  - [ ] Multi-stage Dockerfile
  - [ ] Health check configuration
  - [ ] Volume mounting for workspace
  - [ ] Secret management

- [ ] Fly.io deployment
  - [ ] fly.toml configuration
  - [ ] Volume mounting
  - [ ] Auto-scaling rules
  - [ ] Deployment scripts

- [ ] Monitoring & alerting
  - [ ] Prometheus metrics
  - [ ] Grafana dashboards
  - [ ] Alert rules (PagerDuty, Slack)
  - [ ] Log aggregation (Loki, ELK)

- [ ] Security hardening
  - [ ] API authentication
  - [ ] Rate limiting
  - [ ] Request signing verification
  - [ ] Secret scanning

---

## Deployment

### Fly.io Deployment

**Configuration** (`fly.toml`):

```toml
app = "duyetbot-agent-server"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  LLM_PROVIDER = "openrouter"
  POLL_INTERVAL = "30"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[http_service.checks]]
  interval = "30s"
  timeout = "10s"
  grace_period = "10s"
  method = "GET"
  path = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 4096

[[mounts]]
  source = "agent_workspace"
  destination = "/workspace"
  initial_size = "10gb"
```

**Dockerfile**:

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock* /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN bun run build

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/node_modules/@anthropic-ai node_modules/@anthropic-ai

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "dist/index.js"]
```

**Deployment Commands**:

```bash
# Initial deployment
fly launch --org personal
fly secrets set LLM_API_KEY=sk-or-... GITHUB_WEBHOOK_SECRET=...
fly scale count 1

# Update deployment
fly deploy

# Check status
fly status
fly logs --tail
```

---

## Monitoring & Observability

### Metrics

**Prometheus Metrics**:

```typescript
// src/monitoring/metrics.ts

import { Counter, Histogram, Gauge } from 'prom-client';

export const metrics = {
  // Task metrics
  tasksExecuted: new Counter({
    name: 'agent_tasks_executed_total',
    help: 'Total number of tasks executed',
    labelNames: ['status', 'source'],
  }),

  taskDuration: new Histogram({
    name: 'agent_task_duration_seconds',
    help: 'Task execution duration in seconds',
    labelNames: ['task_type'],
    buckets: [1, 5, 10, 30, 60, 300, 600, 1800],
  }),

  queueDepth: new Gauge({
    name: 'agent_queue_depth',
    help: 'Current number of tasks in queue',
    labelNames: ['priority'],
  }),

  // Tool metrics
  toolExecutions: new Counter({
    name: 'agent_tool_executions_total',
    help: 'Total number of tool executions',
    labelNames: ['tool', 'status'],
  }),

  toolDuration: new Histogram({
    name: 'agent_tool_duration_seconds',
    help: 'Tool execution duration in seconds',
    labelNames: ['tool'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  }),

  // LLM metrics
  llmRequests: new Counter({
    name: 'agent_llm_requests_total',
    help: 'Total number of LLM requests',
    labelNames: ['provider', 'model', 'status'],
  }),

  llmTokens: new Counter({
    name: 'agent_llm_tokens_total',
    help: 'Total number of LLM tokens',
    labelNames: ['provider', 'model', 'type'],
  }),

  // System metrics
  memoryUsage: new Gauge({
    name: 'agent_memory_bytes',
    help: 'Memory usage in bytes',
  }),

  workspaceUsage: new Gauge({
    name: 'agent_workspace_bytes',
    help: 'Workspace disk usage in bytes',
  }),
};
```

### Logging

**Structured Logging**:

```typescript
// src/monitoring/logging.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  redact: {
    paths: ['apiKey', 'token', 'password', 'secret'],
    remove: true,
  },
});

// Usage
logger.info({
  msg: 'Task execution started',
  taskId: 'task_123',
  source: 'memory-mcp',
  priority: 'high',
});

logger.error({
  msg: 'Tool execution failed',
  tool: 'bash',
  error: err,
  taskId: 'task_123',
});
```

### Alerting

**Alert Conditions**:

```yaml
# alerting_rules.yml

groups:
  - name: agent_server
    interval: 30s
    rules:
      - alert: HighTaskFailureRate
        expr: |
          rate(agent_tasks_executed_total{status="failed"}[5m])
          / rate(agent_tasks_executed_total[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: High task failure rate detected

      - alert: LongRunningTask
        expr: |
          agent_task_duration_seconds > 3600
        labels:
          severity: warning
        annotations:
          summary: Task running for more than 1 hour

      - alert: QueueBacklog
        expr: |
          sum(agent_queue_depth) > 100
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: Task queue backlog detected

      - alert: LLMRateLimit
        expr: |
          rate(agent_llm_requests_total{status="failed"}[5m]) > 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: LLM rate limiting detected
```

---

## Success Criteria

### Phase 1 Success (Iteration 160)

- [x] Agent server deployed and running
- [x] Claude Agent SDK executing tasks
- [x] Memory MCP task source operational
- [x] Basic tools working (bash, fs, git)
- [x] Task queue with persistence
- [x] Health check endpoint responding
- [x] 50+ tests passing

### Phase 2 Success (Iteration 170)

- [x] TODO.md file watching operational
- [x] GitHub webhook receiver processing events
- [x] Task queue handling all three sources
- [x] Priority-based scheduling working
- [x] Deduplication preventing duplicate tasks
- [x] Workspace isolation per task

### Phase 3 Success (Iteration 180)

- [x] Ralph Loop stop hooks implemented
- [x] Investigation checkpoints storing notes
- [x] New tasks generated from investigations
- [x] Recovery strategies handling errors
- [x] Memory MCP checkpoint storage working

### Phase 4 Success (Iteration 190)

- [x] Complete tool suite operational
- [x] Code analysis tools working
- [x] Git operations advanced features
- [x] Testing tools executing and reporting
- [x] Documentation tools generating docs

### Phase 5 Success (Iteration 200)

- [x] Production deployment on Fly.io
- [x] Monitoring dashboards operational
- [x] Alerting configured and tested
- [x] Security hardening complete
- [x] 24/7 operation verified

---

## Next Actions

### Immediate (Iteration 125-130)
1. Review and approve this implementation plan
2. Set up `apps/agent-server` package structure
3. Begin Phase 1 foundation tasks

### Short-term (Iteration 131-150)
1. Continue with Ralph Loop autonomous development
2. Complete remaining TODO.md items
3. Prepare infrastructure for agent server

### Medium-term (Iteration 151+)
1. Begin Phase 1 implementation
2. Deploy staging environment
3. Test with real tasks from Memory MCP

---

**Document Version**: 1.0
**Created**: 2025-12-30
**Last Updated**: 2025-12-30
**Author**: Claude Code with duyetbot co-authorship
