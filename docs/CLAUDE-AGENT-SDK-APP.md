# Claude Agent SDK App - Long-Running Agent Server

**Status**: PLANNING
**Priority**: MEDIUM
**Target Start**: Iteration 151+

---

## Overview

A container-based long-running agent server using Claude Agent SDK for:
- Full filesystem access (code operations)
- Shell tools (bash, git, gh CLI)
- Long-running tasks (minutes to hours)
- Heavy compute operations
- Triggered by Tier 1 agents via Workflows

---

## Architecture Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers (Tier 1)              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Telegram Agent / GitHub Agent                    │    │
│  │  • Handle webhooks                                 │    │
│  │  • Quick responses (chat, reviews)                 │    │
│  │  • Detect long-running tasks                       │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          │ Trigger                           │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Workflow Orchestrator                             │    │
│  │  • Detects heavy compute needs                     │    │
│  │  • Creates workflow task                           │    │
│  │  • Notifies agent server                           │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 Agent Server (Tier 2)                       │
│                  Container / VPS / Fly.io                    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Claude Agent SDK Application                      │    │
│  │  • Full Node.js runtime                            │    │
│  │  • Filesystem access                               │    │
│  │  • Shell command execution                         │    │
│  │  • Long-running processes                          │    │
│  │  • Persistent storage                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Tools Available:                                            │
│  ├─ bash: Full shell execution (no timeout limits)         │
│  ├─ git: Clone, commit, push operations                   │
│  ├─ gh: GitHub CLI for complex operations                  │
│  ├─ fs: File read/write/list operations                    │
│  ├─ code: Analysis and editing tools                       │
│  ├─ docker: Container operations (optional)                │
│  └─ custom: Domain-specific tools                          │
└─────────────────────────────────────────────────────────────┘
```

### Communication Flow

```
1. User sends message to Telegram bot
   → "Refactor this repo: https://github.com/user/repo"

2. Telegram Agent receives webhook
   → Analyzes request
   → Detects: needs full clone + analysis + code editing

3. Agent creates workflow task
   POST /api/workflows
   {
     "type": "refactor",
     "repoUrl": "https://github.com/user/repo",
     "instructions": "refactor for performance",
     "priority": "high"
   }

4. Agent Server receives task
   → Clones repository
   → Runs analysis tools
   → Makes code changes
   → Runs tests
   → Creates PR

5. Agent Server updates workflow status
   → Telegram Agent notified
   → User receives result
```

---

## Implementation Plan

### Phase 1: Foundation (Iteration 151-160)

**Target**: Basic agent server with Claude Agent SDK

#### Tasks
- [ ] Set up Node.js/Bun project structure
- [ ] Install Claude Agent SDK (`@anthropic-ai/sdk-agent`)
- [ ] Create agent server with Hono/Fastify
- [ ] Implement basic tool system
- [ ] Add filesystem tools (read, write, list, delete)
- [ ] Add bash tool for shell execution
- [ ] Add git tool (clone, status, commit, push)
- [ ] Implement session management
- [ ] Add health check endpoints
- [ ] Write basic tests

#### File Structure
```
apps/agent-server/
├── src/
│   ├── agent/
│   │   ├── agent.ts          # Claude Agent SDK setup
│   │   ├── tools.ts          # Tool definitions
│   │   └── session.ts        # Session management
│   ├── tools/
│   │   ├── bash.ts           # Shell execution
│   │   ├── git.ts            # Git operations
│   │   ├── fs.ts             # Filesystem operations
│   │   └── gh.ts             # GitHub CLI wrapper
│   ├── api/
│   │   ├── routes.ts         # API endpoints
│   │   ├── workflows.ts      # Workflow handling
│   │   └── health.ts         # Health checks
│   ├── storage/
│   │   ├── sessions.ts       # Session persistence
│   │   └── workspaces.ts     # Workspace management
│   └── index.ts              # Server entry point
├── package.json
├── tsconfig.json
└── wrangler.toml             # Optional: Workers compatibility
```

### Phase 2: Tool Implementation (Iteration 161-170)

**Target**: Full tool suite for code operations

#### Bash Tool
```typescript
{
  name: "bash",
  description: "Execute shell commands with full system access",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string" },
      cwd: { type: "string" },
      timeout: { type: "number", default: 300000 } // 5 min default
    },
    required: ["command"]
  }
}
```

#### Git Tool
```typescript
{
  name: "git",
  description: "Perform Git operations on repositories",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["clone", "status", "commit", "push", "pull", "log", "diff"]
      },
      repoUrl: { type: "string" },
      message: { type: "string" }
    },
    required: ["operation"]
  }
}
```

#### Filesystem Tool
```typescript
{
  name: "fs",
  description: "Read, write, and manipulate files",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["read", "write", "list", "delete", "move", "copy"]
      },
      path: { type: "string" },
      content: { type: "string" }
    },
    required: ["operation", "path"]
  }
}
```

### Phase 3: Workflow Integration (Iteration 171-180)

**Target**: Cloudflare Workers integration

#### Workflow API
```typescript
// apps/telegram-bot/src/workflows.ts

interface WorkflowTask {
  id: string;
  type: 'refactor' | 'analysis' | 'test' | 'deploy' | 'custom';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'completed' | 'failed';
  payload: Record<string, unknown>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

async function createWorkflow(task: Omit<WorkflowTask, 'id' | 'createdAt' | 'status'>): Promise<string> {
  // Store in KV
  // Notify agent server via webhook
  // Return workflow ID
}

async function getWorkflowStatus(id: string): Promise<WorkflowTask | null> {
  // Fetch from KV or agent server
}
```

### Phase 4: Deployment (Iteration 181-190)

**Target**: Production-ready deployment

#### Deployment Options

1. **Fly.io** (Recommended)
   - Simple deployment
   - Built-in secrets management
   - Auto-scaling
   - Volume storage for workspaces

2. **Railway**
   - GitHub integration
   - Built-in Postgres
   - Easy scaling

3. **Self-hosted VPS**
   - Full control
   - Custom domain
   - Manual setup

#### Deployment Configuration
```toml
# fly.toml
app = "duyetbot-agent-server"
primary_region = "sjc"

[build]
  build_target = "start"

[env]
  NODE_ENV = "production"
  ANTHROPIC_API_KEY = ""

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 4096

[[mounts]]
  source = "agent_workspace"
  destination = "/workspace"
```

---

## Security Considerations

### Isolation
- **Sandboxed execution**: Use containers/chroot for file operations
- **Resource limits**: CPU, memory, disk quotas
- **Network restrictions**: Limit outbound connections
- **Timeout enforcement**: Maximum execution time per task

### Authentication
- **API keys**: Secure secret management
- **Request signing**: Verify requests from Workers
- **Rate limiting**: Prevent abuse
- **Audit logging**: Track all operations

### Filesystem Safety
- **Workspace isolation**: Each task in separate directory
- **Path validation**: Prevent directory traversal
- **File size limits**: Prevent disk exhaustion
- **Cleanup jobs**: Remove old workspaces

---

## Monitoring & Observability

### Metrics
- Task queue depth
- Task execution time (P50, P95, P99)
- Success/error rates
- Resource usage (CPU, memory, disk)
- Tool usage statistics

### Logging
- Structured JSON logs
- Log levels: error, warn, info, debug
- Request/response logging
- Error stack traces
- Workflow state changes

### Alerts
- Task failures
- High queue depth
- Resource exhaustion
- Service unavailability

---

## Usage Examples

### Example 1: Repository Refactoring

```
User: "Refactor this repo for better performance"

Telegram Agent:
1. Detects: needs full repo clone + analysis
2. Creates workflow task
3. Returns: "Started refactoring task (ID: abc123)"

Agent Server:
1. Receives workflow task
2. Clones repository to /workspace/abc123/
3. Runs code analysis tools
4. Identifies optimization opportunities
5. Makes code changes
6. Runs tests
7. Creates PR with changes
8. Updates workflow status

Telegram Agent:
1. Receives completion notification
2. Sends: "Refactoring complete! PR created: https://github.com/..."
```

### Example 2: Long-Running Test Suite

```
User: "Run full test suite and fix failures"

Telegram Agent:
1. Creates workflow task
2. Returns: "Running tests (ID: def456)"

Agent Server:
1. Clones repository
2. Installs dependencies
3. Runs test suite (may take 10+ minutes)
4. Analyzes failures
5. Attempts fixes
6. Re-runs tests
7. Reports results

Telegram Agent:
1. Sends detailed test report
2. Includes fixes applied
```

---

## Next Steps

### Immediate (Iteration 126-150)
1. ✅ Complete skeleton screens
2. ✅ Complete MCP server tests
3. ✅ Add local MCP server implementations
4. Continue with queued TODO.md items
5. Implement API security enhancements
6. Add performance optimizations

### For Agent Server (Iteration 151+)
1. Finalize architecture design
2. Set up project structure
3. Implement Claude Agent SDK integration
4. Add tool implementations
5. Deploy to staging
6. Test with Telegram bot
7. Production deployment

---

**Last Updated**: 2025-12-30
**Iteration**: 126
**Status**: Planning complete, ready for implementation
