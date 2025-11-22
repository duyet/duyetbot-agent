# Implementation Plan: duyetbot-agent v3.0 (Redesigned Architecture)

## 🚨 MAJOR ARCHITECTURAL REDESIGN

**Previous Architecture**: Cloudflare Workers-only deployment
**New Architecture**: Long-running container server + Cloudflare MCP memory layer + Monorepo

**This redesign changes the fundamental deployment model from stateless Workers to a stateful container-based system with distributed memory.**

---

## Overview

**A personal AI agent system for @duyet** - helping manage GitHub issues, PRs, code reviews, build/test automation, research, and communication via GitHub mentions (@duyetbot) and Telegram.

### Core Capabilities
- 🤖 **GitHub Integration**: Respond to @duyetbot mentions, manage issues/PRs, automated reviews
- 💬 **Telegram Bot**: Chat interface for quick queries and notifications
- 🧠 **Persistent Memory**: MCP-based memory server on Cloudflare Workers (D1 + KV)
- 🛠️ **Multi-LLM Support**: Claude, OpenAI, OpenRouter, Z.AI (via base URL override)
- 📦 **Monorepo**: Separated packages for core, tools, server, CLI, MCP, bots
- 🐳 **Container Deployment**: Long-running Node.js/Bun server for stateful agent sessions
- 💻 **CLI Support**: Local execution with optional cloud memory access

### Use Cases

**CLI & Terminal**
- Interactive chat: `duyetbot chat` for debugging, explanations, code generation
- One-shot questions: `duyetbot ask "How to implement rate limiting?"`
- Research: Compare technologies, learn concepts, get news summaries

**GitHub Integration**
- Code review: `@duyetbot review this PR`, `@duyetbot check for security issues`
- PR management: `@duyetbot merge when CI passes`, `@duyetbot squash and merge`
- Issue triage: `@duyetbot add labels`, `@duyetbot assign to @duyet`
- Analysis: `@duyetbot explain this code`, `@duyetbot why are tests failing?`
- Release: `@duyetbot generate changelog`, `@duyetbot create release notes`

**Telegram Bot**
- Quick queries: Weather, currency conversion, time zones
- Development help: Error fixes, best practices, explanations
- Notifications: PR approvals, deployment status, CI failures

**Automation & Proactive Tasks**
- Auto-merge PRs when conditions met (CI pass, approvals, no unresolved)
- Morning briefing: GitHub activity, calendar, weather, tech news
- Auto-review all PRs for security/performance issues
- Weekly dependency updates with security patches
- Auto-generate documentation on PR merge

**Personal Assistant**
- Task management: Add todos, check agenda, set reminders
- Communication: Draft responses, summarize discussions, translate
- Organization: Organize notes, create mind maps, summarize meetings

📖 **See [docs/USECASES.md](docs/USECASES.md) for complete examples and configurations.**

---

## ⚠️ IMPORTANT: Keeping This Plan Updated

**This is a living document that MUST be maintained throughout development.**

When working on this project:
1. **Read this plan before starting any work** to understand current phase and dependencies
2. **Mark tasks complete `[x]` immediately** as you finish them (don't batch updates)
3. **Add new tasks** discovered during implementation to the appropriate phase
4. **Update the Revision History** table at the bottom when making changes
5. **Commit PLAN.md along with your code changes**

📖 **See CLAUDE.md "Development Workflow" section for detailed instructions.**

---

## New Architecture Overview

### Hybrid Supervisor-Worker Model

The architecture implements a **Hybrid Supervisor-Worker Model** that combines the best of serverless orchestration with containerized compute:

- **Supervisor (Cloudflare Workflows)**: The "Brain" - orchestration, state management, webhook ingestion, human-in-the-loop
- **Worker (Fly.io Machines)**: The "Hands" - filesystem, shell tools, Claude Agent SDK execution

This solves the fundamental challenge: heavy LLM tasks need a "computer-like" environment, but we want serverless cost-efficiency.

### High-Level System Design

```
┌──────────────────────────────────────────────────────────────────┐
│                        User Interactions                          │
├────────────────┬────────────────┬──────────────┬─────────────────┤
│ GitHub @mentions│ Telegram Bot   │  CLI Tool    │ Web UI (future) │
└────────┬───────┴────────┬───────┴──────┬───────┴─────────────────┘
         │                │              │
         ▼                ▼              │
┌─────────────────────────────────────────────────────────────────┐
│              Ingress Worker (Cloudflare Worker)                  │
│  • Webhook signature validation                                  │
│  • Event routing                                                 │
│  • Instance management                                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│           Workflow Supervisor (Cloudflare Durable Object)        │
│  • State machine: status, machine_id, volume_id                  │
│  • Provisions Fly.io resources                                   │
│  • Manages Human-in-the-Loop wait states                         │
│  • Can sleep for days/weeks without cost                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Agent Runner (Fly.io Machine)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Docker Container                                          │ │
│  │  • Node.js + git + gh + ripgrep                            │ │
│  │  • Claude Agent SDK                                        │ │
│  │  • Custom tools (GitHub, Research)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Persistent Volume (NVMe)                                  │ │
│  │  • Session state (/root/.claude)                           │ │
│  │  • Conversation history                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │ GitHub │  │Anthropic│  │  MCP   │
         │  API   │  │   API   │  │ Memory │
         └────────┘  └────────┘  └────────┘
```

### Key Architectural Decisions

| Component | Design Choice | Rationale |
|-----------|---------------|-----------|
| **Orchestration** | Cloudflare Workflows | Durable execution, free sleep (365 days), built-in retries |
| **Compute** | Fly.io Machines | Full Linux, fast boot (~2s), API-driven lifecycle |
| **State** | Fly.io Volumes | SDK requires filesystem, NVMe performance, Volume-as-Session |
| **Agent Engine** | Claude Agent SDK | Battle-tested, maintained by Anthropic |
| **Feedback** | GitHub Checks API | Real-time streaming, action_required for HITL |
| **Memory** | MCP Server (CF Workers) | Cross-session search, user isolation |
| **Project Structure** | Monorepo (pnpm) | Separated concerns, independent deployments |
| **Provider System** | Base URL override | Flexible (Z.AI, custom endpoints) |

### Two-Tier Agent Architecture

The system uses two types of agents:

**Tier 1: Cloudflare Agents (Lightweight)**
- Fast, serverless agents for quick responses
- Deploy to Cloudflare Workers
- Can trigger Cloudflare Workflows for:
  - **Deferred tasks**: Reminders, scheduled messages (e.g., `@duyetbot remind me in 10 min`)
  - **Complex tasks**: Heavy compute requiring Tier 2

| App | Runtime | Worker Name | Purpose |
|-----|---------|-------------|---------|
| `apps/telegram-bot` | Workers + Durable Objects | `duyetbot-telegram` | Telegram chat |
| `apps/github-bot` | Workers + Durable Objects | `duyetbot-github` | GitHub webhooks |
| `apps/memory-mcp` | Workers | `duyetbot-memory-mcp` | Memory storage |

**Tier 2: Claude Agent SDK (Heavy)**
- Long-running agents for complex tasks
- Run on containers (Cloudflare sandbox)
- Triggered by Tier 1 agents via Workflows

| App | Runtime | Purpose |
|-----|---------|---------|
| `apps/agent-server` | Container | Full filesystem/shell tools |

**Note**: Tier 2 implementation planned for later phases.

**Shared Prompts** (`packages/prompts`):
- `prompts/telegram.md` - Telegram bot personality
- `prompts/github.md` - GitHub bot personality
- `prompts/default.md` - Base prompt fragments

### Volume-as-Session Pattern

The Claude Agent SDK relies on local filesystem for session state. We solve this with persistent Fly.io Volumes:

```
Volume Creation:
  PR #123 opened → Create vol_duyetbot_pr_123

Mount on Run:
  Machine boots → Mount volume to /root/.claude

Session Persistence:
  SDK writes → Actually writes to NVMe volume
  Machine dies → Data survives

Resume:
  Next webhook → New machine, same volume
  SDK boots → Finds existing state, resumes context
```

This enables multi-day conversations without complex database serialization.

### Human-in-the-Loop via GitHub Checks API

For tasks requiring human approval:

1. **Agent Decision** → Reaches decision point requiring approval
2. **Check Update** → Status: `action_required`, Actions: `[{ label: "Approve" }]`
3. **Workflow Sleep** → Runner exits, Supervisor calls `step.wait_for_event()`
4. **User Clicks Button** → GitHub sends `check_run.requested_action` webhook
5. **Resume** → Workflow wakes, provisions new machine, agent resumes

This allows the bot to wait days/weeks for user input without cost.

### Cost Model

**Scenario: 100 PRs/month, 10 min avg active time**

| Component | Calculation | Cost |
|-----------|-------------|------|
| Fly.io Compute | 60,000s × $0.000011/s | $0.66 |
| Fly.io Storage | 100 PRs × 1GB × 5 days | $2.50 |
| Cloudflare | Mostly routing | ~$0.50 |
| **Total** | | **~$3.66/mo** |

Compare to always-on containers: **~$58/mo** (2× machines)

---

## Monorepo Structure (pnpm Workspaces)

```
duyetbot-agent/
├── packages/
│   ├── core/                       # Core agent logic
│   │   ├── src/
│   │   │   ├── agent/             # Agent orchestration
│   │   │   ├── sdk/               # Claude Agent SDK integration
│   │   │   ├── session/           # Session management
│   │   │   └── mcp/               # MCP client
│   │   └── package.json
│   │
│   ├── chat-agent/                 # Reusable chat agent for Workers
│   │   ├── src/
│   │   │   ├── agent.ts           # ChatAgent base class
│   │   │   ├── cloudflare-agent.ts # Cloudflare Agents SDK adapter
│   │   │   ├── factory.ts         # createChatAgent()
│   │   │   ├── history.ts         # Conversation history
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── prompts/                    # Shared system prompts
│   │   ├── prompts/
│   │   │   ├── default.md         # Base prompt fragments
│   │   │   ├── telegram.md        # Telegram bot personality
│   │   │   └── github.md          # GitHub bot personality
│   │   ├── src/
│   │   │   ├── prompts.ts         # Prompt loaders
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── providers/                  # LLM provider abstractions
│   │   ├── src/
│   │   │   ├── base.ts            # Base provider interface
│   │   │   ├── claude.ts          # Claude provider
│   │   │   ├── openrouter.ts      # OpenRouter provider
│   │   │   └── factory.ts         # Provider factory with URL override
│   │   └── package.json
│   │
│   ├── tools/                      # Tool implementations
│   │   ├── src/
│   │   │   ├── bash.ts
│   │   │   ├── git.ts
│   │   │   ├── github.ts          # GitHub API operations
│   │   │   ├── research.ts
│   │   │   ├── plan.ts
│   │   │   ├── sleep.ts
│   │   │   └── registry.ts
│   │   └── package.json
│   │
│   ├── server/                     # Long-running agent server (Node.js/Bun)
│   │   ├── src/
│   │   │   ├── index.ts           # Server entry point
│   │   │   ├── agent-runner.ts    # Agent execution engine
│   │   │   ├── websocket.ts       # WebSocket server (streaming)
│   │   │   ├── mcp-client.ts      # MCP client for memory server
│   │   │   └── config.ts          # Server configuration
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── cli/                        # CLI tool
│   │   ├── src/
│   │   │   ├── index.ts           # CLI entry point
│   │   │   ├── commands/          # Command implementations
│   │   │   │   ├── chat.ts
│   │   │   │   ├── login.ts
│   │   │   │   ├── run.ts
│   │   │   │   └── memory.ts
│   │   │   ├── ui/                # Terminal UI (Ink)
│   │   │   │   ├── App.tsx
│   │   │   │   ├── ChatView.tsx
│   │   │   │   └── StatusBar.tsx
│   │   │   ├── mcp-client.ts      # MCP client for memory
│   │   │   └── local-mode.ts      # Standalone local execution
│   │   └── package.json
│   │
│   ├── sdk/                        # Client SDK for API
│   │   ├── src/
│   │   │   ├── client.ts          # HTTP client
│   │   │   ├── websocket.ts       # WebSocket client
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   └── types/                      # Shared TypeScript types
│       ├── src/
│       │   ├── agent.ts
│       │   ├── session.ts
│       │   ├── message.ts
│       │   ├── tool.ts
│       │   └── provider.ts
│       └── package.json
│
├── apps/
│   ├── api/                        # HTTP API Gateway (Hono)
│   │   ├── src/
│   │   │   ├── index.ts           # API entry point
│   │   │   ├── routes/
│   │   │   │   ├── agent.ts       # /agent/* endpoints
│   │   │   │   ├── github.ts      # /github/* webhooks
│   │   │   │   ├── telegram.ts    # /telegram/* webhooks
│   │   │   │   └── health.ts      # /health/* endpoints
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts        # GitHub user verification
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── cors.ts
│   │   │   └── config.ts
│   │   └── package.json
│   │
│   ├── github-bot/                 # GitHub App/webhook handler
│   │   ├── src/
│   │   │   ├── index.ts           # Bot entry point
│   │   │   ├── webhooks/
│   │   │   │   ├── mention.ts     # @duyetbot mentions
│   │   │   │   ├── issue.ts       # Issue events
│   │   │   │   ├── pr.ts          # PR events
│   │   │   │   └── comment.ts     # Comment events
│   │   │   ├── actions/
│   │   │   │   ├── review-pr.ts
│   │   │   │   ├── summarize.ts
│   │   │   │   ├── test.ts
│   │   │   │   └── research.ts
│   │   │   └── github-api.ts      # GitHub API client
│   │   └── package.json
│   │
│   ├── telegram-bot/               # Telegram bot integration
│   │   ├── src/
│   │   │   ├── index.ts           # Bot entry point
│   │   │   ├── commands/
│   │   │   │   ├── start.ts
│   │   │   │   ├── chat.ts
│   │   │   │   ├── help.ts
│   │   │   │   └── status.ts
│   │   │   ├── handlers/
│   │   │   │   └── message.ts
│   │   │   └── telegram-api.ts
│   │   └── package.json
│   │
│   └── web/                        # Web UI (optional, future)
│       ├── src/
│       └── package.json
│
├── infrastructure/
│   ├── cloudflare/
│   │   └── wrangler.toml          # MCP server deployment
│   ├── docker/
│   │   ├── docker-compose.yml     # Server + dependencies
│   │   └── agent-server.Dockerfile
│   └── kubernetes/                 # K8s manifests (optional)
│       ├── deployment.yaml
│       └── service.yaml
│
├── .github/
│   └── workflows/
│       ├── deploy-mcp.yml         # Deploy MCP server to CF Workers
│       ├── deploy-server.yml      # Deploy agent server to container
│       └── tests.yml
│
├── pnpm-workspace.yaml
├── turbo.json                      # Turborepo configuration
├── package.json                    # Root package
├── CLAUDE.md
├── ARCHITECTURE.md
└── PLAN.md (this file)
```

---

## Provider System with Base URL Override

### Motivation

Support alternative LLM providers that use Claude-compatible APIs (e.g., Z.AI) by overriding the base URL while keeping the same provider interface.

### Configuration Format

**Environment Variables**:
```bash
# Standard Claude
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_BASE_URL="https://api.anthropic.com"

# Z.AI (Claude-compatible API)
ZAI_API_KEY="your_zai_api_key"
ZAI_BASE_URL="https://api.z.ai/api/anthropic"

# Override default models (optional)
MODEL_HAIKU="glm-4.5-air"
MODEL_SONNET="glm-4.6"
MODEL_OPUS="glm-4.6"

# Set environment to use Z.AI
export ANTHROPIC_AUTH_TOKEN="$ZAI_API_KEY"
export ANTHROPIC_BASE_URL="$ZAI_BASE_URL"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$MODEL_HAIKU"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$MODEL_SONNET"
export ANTHROPIC_DEFAULT_OPUS_MODEL="$MODEL_OPUS"
```

**Configuration File** (`~/.duyetbot/config.json`):
```json
{
  "providers": [
    {
      "name": "claude",
      "type": "anthropic",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "baseUrl": "https://api.anthropic.com",
      "models": {
        "haiku": "claude-3-5-haiku-20241022",
        "sonnet": "claude-3-5-sonnet-20241022",
        "opus": "claude-3-opus-20240229"
      }
    },
    {
      "name": "zai",
      "type": "anthropic",
      "apiKey": "${ZAI_API_KEY}",
      "baseUrl": "https://api.z.ai/api/anthropic",
      "models": {
        "haiku": "glm-4.5-air",
        "sonnet": "glm-4.6",
        "opus": "glm-4.6"
      }
    },
    {
      "name": "openrouter",
      "type": "openrouter",
      "apiKey": "${OPENROUTER_API_KEY}",
      "baseUrl": "https://openrouter.ai/api/v1"
    }
  ],
  "defaultProvider": "claude"
}
```

### Provider Factory Implementation

```typescript
// packages/providers/src/factory.ts
interface ProviderConfig {
  type: 'anthropic' | 'openrouter' | 'custom';
  apiKey: string;
  baseUrl?: string;  // Optional base URL override
  models?: Record<string, string>;  // Model name mappings
}

class ProviderFactory {
  static create(config: ProviderConfig): LLMProvider {
    switch (config.type) {
      case 'anthropic':
        return new ClaudeProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl || 'https://api.anthropic.com',
          models: config.models,
        });
      case 'openrouter':
        return new OpenRouterProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
        });
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }
}
```

---

## MCP Memory Server Design

### Overview

The Memory MCP Server runs on Cloudflare Workers and exposes memory/storage as MCP resources. This allows the CLI, server, and other clients to access persistent memory via the standardized MCP protocol.

### MCP Tools Exposed

#### 1. `authenticate`
**Description**: Authenticate user via GitHub token or OAuth

**Input**:
```typescript
{
  github_token?: string;
  oauth_code?: string;
}
```

**Output**:
```typescript
{
  user_id: string;
  session_token: string;
  expires_at: number;
}
```

#### 2. `get_memory`
**Description**: Retrieve session messages and context

**Input**:
```typescript
{
  session_id: string;
  limit?: number;
  offset?: number;
}
```

**Output**:
```typescript
{
  session_id: string;
  messages: Array<LLMMessage>;
  metadata: Record<string, any>;
}
```

#### 3. `save_memory`
**Description**: Save messages to session

**Input**:
```typescript
{
  session_id: string;
  messages: Array<LLMMessage>;
  metadata?: Record<string, any>;
}
```

**Output**:
```typescript
{
  session_id: string;
  saved_count: number;
  updated_at: number;
}
```

#### 4. `search_memory`
**Description**: Semantic search across all user's sessions

**Input**:
```typescript
{
  query: string;
  limit?: number;
  filter?: {
    session_id?: string;
    date_range?: { start: number; end: number };
  };
}
```

**Output**:
```typescript
{
  results: Array<{
    session_id: string;
    message: LLMMessage;
    score: number;
    context: Array<LLMMessage>;
  }>;
}
```

#### 5. `list_sessions`
**Description**: List user's sessions

**Input**:
```typescript
{
  limit?: number;
  offset?: number;
  state?: 'active' | 'paused' | 'completed';
}
```

**Output**:
```typescript
{
  sessions: Array<{
    id: string;
    title: string;
    state: string;
    created_at: number;
    updated_at: number;
    message_count: number;
  }>;
  total: number;
}
```

### Storage Schema (D1 + KV)

**D1 Tables**:
```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id TEXT UNIQUE NOT NULL,
  github_login TEXT NOT NULL,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_users_github ON users(github_id);

-- Sessions table (metadata only)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  state TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT, -- JSON
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id, updated_at DESC);
CREATE INDEX idx_sessions_state ON sessions(user_id, state);

-- Session auth tokens
CREATE TABLE session_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_tokens_user ON session_tokens(user_id);
CREATE INDEX idx_tokens_expires ON session_tokens(expires_at);
```

**KV Storage**:
```typescript
// Messages (hot data)
// Key: `sessions:{session_id}:messages`
// Value: JSONL format (append-only for efficiency)
{
  session_id: string;
  messages: string; // JSONL: one message per line
  updated_at: number;
}

// Vector embeddings (for search)
// Handled by Cloudflare Vectorize
```

### MCP Server Implementation

```typescript
// apps/memory-mcp/src/mcp-server.ts
import { createMCPServer } from '@anthropic-ai/mcp-server';

const mcpServer = createMCPServer({
  name: 'duyetbot-memory',
  version: '1.0.0',

  tools: [
    {
      name: 'authenticate',
      description: 'Authenticate user via GitHub token',
      inputSchema: z.object({
        github_token: z.string().optional(),
        oauth_code: z.string().optional(),
      }),
      handler: async (input, context) => {
        // Verify GitHub token or OAuth code
        // Create session token
        // Return user_id and session_token
      },
    },
    {
      name: 'get_memory',
      description: 'Retrieve session messages',
      inputSchema: z.object({
        session_id: z.string(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
      handler: async (input, context) => {
        // Get session from D1
        // Get messages from KV
        // Return formatted response
      },
    },
    // ... other tools
  ],

  resources: [
    {
      uri: 'memory://sessions',
      name: 'User Sessions',
      description: 'List of all user sessions',
      handler: async (uri, context) => {
        // Return list of sessions
      },
    },
  ],
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return mcpServer.handleRequest(request, {
      D1: env.DB,
      KV: env.KV,
      VECTORIZE: env.VECTORIZE,
    });
  },
};
```

---

## Long-Running Agent Server Design

### Overview

The agent server runs as a long-lived Node.js/Bun process in a container. It maintains stateful agent sessions and handles requests from the API gateway.

### Key Features

1. **Stateful Sessions**: Keep agent context in memory for fast access
2. **WebSocket Support**: Real-time streaming to clients
3. **MCP Client**: Connects to memory MCP server for persistence
4. **Tool Execution**: Execute bash, git, GitHub operations in isolated environment
5. **Queue System**: Background job processing

### Server Architecture

```typescript
// apps/agent-server/src/index.ts
import { createAgent } from '@duyetbot/core';
import { MCPClient } from '@anthropic-ai/mcp-client';
import { WebSocketServer } from 'ws';

class AgentServer {
  private mcpClient: MCPClient;
  private activeSessions: Map<string, AgentSession> = new Map();

  async start() {
    // Connect to MCP memory server
    this.mcpClient = new MCPClient({
      url: process.env.MCP_SERVER_URL,
    });

    // Start WebSocket server
    const wss = new WebSocketServer({ port: 8080 });
    wss.on('connection', this.handleWebSocket.bind(this));

    // Start HTTP API
    const app = new Hono();
    app.post('/execute', this.handleExecute.bind(this));
    app.listen(3000);
  }

  async handleExecute(req: Request) {
    const { session_id, message, user_id } = await req.json();

    // Get or create session
    let session = this.activeSessions.get(session_id);
    if (!session) {
      // Load session from MCP memory server
      const memoryData = await this.mcpClient.call('get_memory', {
        session_id,
      });

      session = await createAgent({
        sessionId: session_id,
        initialMessages: memoryData.messages,
        tools: getAllTools(),
        providers: getProviders(),
      });

      this.activeSessions.set(session_id, session);
    }

    // Execute agent
    const response = await session.execute(message);

    // Save to memory
    await this.mcpClient.call('save_memory', {
      session_id,
      messages: session.getMessages(),
    });

    return response;
  }

  async handleWebSocket(ws: WebSocket) {
    ws.on('message', async (data) => {
      const { type, session_id, message } = JSON.parse(data.toString());

      if (type === 'chat') {
        const session = this.activeSessions.get(session_id);
        if (!session) {
          ws.send(JSON.stringify({ error: 'Session not found' }));
          return;
        }

        // Stream response via WebSocket
        for await (const chunk of session.stream(message)) {
          ws.send(JSON.stringify({ type: 'chunk', data: chunk }));
        }

        ws.send(JSON.stringify({ type: 'done' }));
      }
    });
  }
}

const server = new AgentServer();
server.start();
```

### Deployment

**Docker Compose**:
```yaml
# infrastructure/docker/docker-compose.yml
version: '3.8'

services:
  agent-server:
    build:
      context: ../../
      dockerfile: infrastructure/docker/agent-server.Dockerfile
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - MCP_SERVER_URL=https://memory.duyetbot.workers.dev
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Dockerfile**:
```dockerfile
# infrastructure/docker/agent-server.Dockerfile
FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies
COPY package.json pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/

RUN bun install --frozen-lockfile

# Build all packages
RUN bun run build

# Expose ports
EXPOSE 3000 8080

# Start server
CMD ["bun", "run", "apps/agent-server/src/index.ts"]
```

---

## CLI with Remote Memory Access

### Design

The CLI can operate in two modes:

1. **Local Mode**: Standalone execution without network (uses local file storage)
2. **Cloud Mode**: Connect to MCP memory server for persistent sessions

### Commands

```bash
# Authentication
duyetbot login                      # Authenticate with GitHub
duyetbot logout                     # Clear credentials
duyetbot whoami                     # Show current user

# Chat
duyetbot chat                       # Interactive chat (cloud mode)
duyetbot chat --local               # Local mode (no network)
duyetbot ask "question"             # One-shot question
duyetbot run "task description"     # Execute specific task

# Sessions
duyetbot sessions list              # List all sessions (from MCP)
duyetbot sessions new "title"       # Create new session
duyetbot sessions resume <id>       # Resume session
duyetbot sessions delete <id>       # Delete session
duyetbot sessions export <id>       # Export session to JSON

# Memory
duyetbot memory search "query"      # Semantic search across history
duyetbot memory stats               # Show memory usage stats

# Configuration
duyetbot config set provider zai    # Switch LLM provider
duyetbot config get                 # Show current config
duyetbot config edit                # Edit config file
```

### Implementation

```typescript
// packages/cli/src/commands/chat.ts
import { MCPClient } from '@anthropic-ai/mcp-client';
import { createAgent } from '@duyetbot/core';
import { render } from 'ink';
import { ChatUI } from '../ui/ChatView';

export async function chatCommand(options: { local?: boolean }) {
  if (options.local) {
    // Local mode: use file storage
    const agent = await createAgent({
      sessionManager: new FileSessionManager('~/.duyetbot/sessions'),
      tools: getAllTools(),
    });

    render(<ChatUI agent={agent} mode="local" />);
  } else {
    // Cloud mode: connect to MCP server
    const mcpClient = new MCPClient({
      url: process.env.MCP_SERVER_URL || 'https://memory.duyetbot.workers.dev',
      auth: {
        token: loadGitHubToken(),
      },
    });

    // Authenticate
    const authResult = await mcpClient.call('authenticate', {
      github_token: loadGitHubToken(),
    });

    // Create session
    const session = await mcpClient.call('list_sessions', { limit: 1 });
    const sessionId = session.sessions[0]?.id || crypto.randomUUID();

    // Load messages from MCP
    const memory = await mcpClient.call('get_memory', { session_id: sessionId });

    // Create agent with MCP-backed storage
    const agent = await createAgent({
      sessionId,
      initialMessages: memory.messages,
      tools: getAllTools(),
      onMessage: async (messages) => {
        // Auto-save to MCP after each turn
        await mcpClient.call('save_memory', {
          session_id: sessionId,
          messages,
        });
      },
    });

    render(<ChatUI agent={agent} mcpClient={mcpClient} mode="cloud" />);
  }
}
```

---

## GitHub Integration (@duyetbot)

### Overview

Full GitHub App integration that responds to `@duyetbot` mentions in issues, PRs, and comments.

### Capabilities

1. **@duyetbot mentions**: Respond to mentions with agent-generated responses
2. **Issue management**: Create, update, label, close issues
3. **PR reviews**: Automated code reviews with inline comments
4. **Build/Test**: Trigger CI/CD, analyze test failures
5. **Research**: Gather information and summarize
6. **Documentation**: Generate/update docs

### Example Usage

**In GitHub Issue**:
```markdown
@duyetbot analyze the failing tests in PR #123 and suggest fixes
```

**Agent Response**:
```markdown
I've analyzed PR #123 and found 3 failing tests:

1. **test_user_authentication** (line 45)
   - **Issue**: Mock GitHub OAuth token expired
   - **Fix**: Update test fixture with valid token

2. **test_memory_search** (line 78)
   - **Issue**: Vectorize index not initialized in test environment
   - **Fix**: Add index initialization in test setup

3. **test_rate_limiting** (line 102)
   - **Issue**: Race condition in concurrent requests
   - **Fix**: Add proper synchronization

I can create a PR with these fixes if you'd like. Reply with `@duyetbot fix tests` to proceed.
```

### GitHub Webhook Handler

```typescript
// apps/github-bot/src/webhooks/mention.ts
import { createAgent } from '@duyetbot/core';
import { Octokit } from '@octokit/rest';
import { MCPClient } from '@anthropic-ai/mcp-client';

export async function handleMention(event: GitHubWebhookEvent) {
  const { comment, issue, repository } = event;

  // Extract @duyetbot mention
  const mentionRegex = /@duyetbot\s+(.+)/;
  const match = comment.body.match(mentionRegex);
  if (!match) return;

  const task = match[1];

  // Create GitHub API client
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // Create MCP client for memory
  const mcpClient = new MCPClient({
    url: process.env.MCP_SERVER_URL,
    auth: { token: process.env.MCP_AUTH_TOKEN },
  });

  // Create or load session for this issue/PR
  const sessionId = `github:${repository.full_name}:${issue.number}`;
  const memory = await mcpClient.call('get_memory', {
    session_id: sessionId,
  }).catch(() => ({ messages: [] }));

  // Create agent with GitHub context
  const agent = await createAgent({
    sessionId,
    initialMessages: memory.messages,
    tools: [
      bashTool,
      gitTool,
      githubTool(octokit, repository, issue), // GitHub-specific tool
      researchTool,
      planTool,
    ],
    systemPrompt: `You are @duyetbot, an AI assistant helping @duyet with GitHub tasks.

Current context:
- Repository: ${repository.full_name}
- Issue/PR: #${issue.number} - ${issue.title}
- Task: ${task}

You have access to GitHub API, bash, git, and research tools. Provide clear, actionable responses.`,
  });

  // Execute task
  const response = await agent.execute(task);

  // Post comment
  await octokit.issues.createComment({
    owner: repository.owner.login,
    repo: repository.name,
    issue_number: issue.number,
    body: response.content,
  });

  // Save session to memory
  await mcpClient.call('save_memory', {
    session_id: sessionId,
    messages: agent.getMessages(),
  });
}
```

### GitHub Tool Implementation

```typescript
// packages/tools/src/github.ts
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { Octokit } from '@octokit/rest';

export function createGitHubTool(
  octokit: Octokit,
  repo: { owner: string; name: string },
) {
  return tool(
    'github',
    'Interact with GitHub API for repository operations',
    z.object({
      action: z.enum([
        'get_pr',
        'get_issue',
        'create_issue',
        'update_issue',
        'create_comment',
        'get_diff',
        'get_file',
        'create_review',
        'merge_pr',
        'trigger_workflow',
      ]),
      params: z.record(z.any()),
    }),
    async ({ action, params }) => {
      switch (action) {
        case 'get_pr':
          const pr = await octokit.pulls.get({
            ...repo,
            pull_number: params.number,
          });
          return {
            title: pr.data.title,
            body: pr.data.body,
            state: pr.data.state,
            files_changed: pr.data.changed_files,
            commits: pr.data.commits,
          };

        case 'get_diff':
          const diff = await octokit.pulls.get({
            ...repo,
            pull_number: params.number,
            mediaType: { format: 'diff' },
          });
          return diff.data;

        case 'create_comment':
          await octokit.issues.createComment({
            ...repo,
            issue_number: params.issue_number,
            body: params.body,
          });
          return { success: true };

        case 'create_review':
          await octokit.pulls.createReview({
            ...repo,
            pull_number: params.number,
            body: params.body,
            event: params.event || 'COMMENT',
            comments: params.comments,
          });
          return { success: true };

        // ... other actions

        default:
          throw new Error(`Unknown GitHub action: ${action}`);
      }
    },
  );
}
```

---

## Telegram Integration

### Overview

Telegram bot for quick queries and notifications.

### Commands

```
/start - Initialize bot
/chat <message> - Chat with agent
/status - Check agent status
/sessions - List recent sessions
/help - Show help
```

### Implementation

```typescript
// apps/telegram-bot/src/index.ts
import { Telegraf } from 'telegraf';
import { MCPClient } from '@anthropic-ai/mcp-client';
import { createAgent } from '@duyetbot/core';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const mcpClient = new MCPClient({
  url: process.env.MCP_SERVER_URL,
});

bot.command('chat', async (ctx) => {
  const message = ctx.message.text.replace('/chat', '').trim();
  if (!message) {
    return ctx.reply('Usage: /chat <your message>');
  }

  const userId = `telegram:${ctx.from.id}`;
  const sessionId = `telegram:${ctx.from.id}:${Date.now()}`;

  // Load memory
  const memory = await mcpClient.call('get_memory', {
    session_id: sessionId,
  }).catch(() => ({ messages: [] }));

  // Create agent
  const agent = await createAgent({
    sessionId,
    initialMessages: memory.messages,
    tools: [bashTool, researchTool, planTool],
  });

  // Execute
  const response = await agent.execute(message);

  // Reply
  await ctx.reply(response.content);

  // Save
  await mcpClient.call('save_memory', {
    session_id: sessionId,
    messages: agent.getMessages(),
  });
});

bot.launch();
```

---

## Development Phases

### Phase 1: Monorepo Setup (2-3 days) ✅ COMPLETED

**Goal**: Set up monorepo structure with pnpm workspaces

**Tasks**:
- [x] Create pnpm-workspace.yaml
- [x] Set up Turborepo for builds
- [x] Create packages/core with shared types
- [x] Create packages/types
- [x] Create packages/providers
- [x] Create packages/tools
- [x] Set up TypeScript configurations
- [x] Copy src files to appropriate packages
- [x] Update import paths to use @duyetbot/* packages
- [x] Configure root package.json with monorepo scripts
- [x] Run bun install
- [x] Build all packages successfully with turbo

**Output**: Working monorepo with build system ✅

**Completed**: 2025-11-19

---

### Phase 2: MCP Memory Server (4-5 days) ✅ IN PROGRESS

**Goal**: Implement MCP server on Cloudflare Workers with D1 + KV storage

**Tasks**:
- [x] Create apps/memory-mcp package
- [x] Set up Cloudflare Workers entry point (Hono HTTP API)
- [x] Implement MCP server using @modelcontextprotocol/sdk
- [x] Create D1 schema (users, sessions, tokens)
- [x] Create D1 migration system
- [x] Implement `authenticate` tool (GitHub token verification)
- [x] Implement `get_memory` tool (D1 + KV read)
- [x] Implement `save_memory` tool (D1 + KV write)
- [x] Implement `search_memory` tool (text search, Vectorize ready)
- [x] Implement `list_sessions` tool
- [x] Add rate limiting (per user)
- [x] Write comprehensive tests (93 tests passing)
- [ ] Deploy to Cloudflare Workers
- [x] Create wrangler.toml configuration
- [ ] Document MCP API

**Output**: Production MCP memory server ✅

**Progress**: Core implementation complete (2025-11-20). 93 tests passing. Deployment and documentation pending.

---

### Phase 3: Refactor Core Packages (3-4 days) ✅ COMPLETED

**Goal**: Extract and refactor existing code into monorepo packages

**Tasks**:
- [x] Move src/providers/ → packages/providers/
  - [x] Refactor ClaudeProvider with base URL override support
  - [x] Refactor OpenRouterProvider
  - [x] Create Z.AI provider helper (createZAIConfig, createProviderConfig)
  - [x] Update ProviderFactory to support base URL config
  - [ ] Add provider configuration loader
  - [x] Write provider tests (38 tests)
- [x] Move src/tools/ → packages/tools/
  - [x] Extract bash, git, plan, sleep, research tools
  - [x] Create new `github` tool for GitHub API operations
  - [x] Add ToolRegistry
  - [x] Write tool tests (51 tests)
- [x] Move src/agent/ → packages/core/
  - [x] Extract Agent core
  - [x] Extract Session management
  - [x] Add MCP client integration for memory
  - [x] Write core tests (57 tests)
- [x] Update import paths across all packages
- [x] Run all tests (239 tests passing)

**Output**: Modular packages with maintained test coverage ✅

**Progress**: Phase 3 COMPLETE (2025-11-20). Base URL override support and Z.AI helpers added to providers. GitHub tool created with 10 actions. MCP client added to core package. 239 tests passing: 93 memory-mcp + 38 providers + 51 tools + 57 core.

---

### Phase 4: Long-Running Agent Server (5-6 days) ✅ COMPLETED

**Goal**: Build containerized server with WebSocket support

**Tasks**:
- [x] Create apps/agent-server package
- [x] Implement server entry point
- [ ] Add MCP client for memory server connection
- [x] Implement AgentSessionManager (in-memory + MCP persistence)
- [x] Create WebSocket server for streaming
- [x] Add HTTP API for /execute endpoint
- [x] Implement session lifecycle management
- [x] Add graceful shutdown handling
- [x] Create health check endpoints
- [x] Write Dockerfile for deployment
- [x] Write docker-compose.yml for local dev
- [x] Add server configuration system
- [x] Write server tests (36 tests)
- [ ] Document deployment process

**Output**: Production-ready agent server ✅

**Progress**: Phase 4 COMPLETE (2025-11-20). Server package created with config, session manager, routes (health + agent), WebSocket server with streaming support, and graceful shutdown. 36 tests passing. Docker and docker-compose configurations created. MCP client integration pending.

---

### Phase 5: CLI with MCP Integration (4-5 days) ✅ COMPLETED

**Goal**: Full-featured CLI with cloud and local modes

**Tasks**:
- [x] Create packages/cli package
- [x] Set up Commander.js command structure
- [x] Implement `login` command (wired to GitHubDeviceAuth)
- [x] Implement `logout` command
- [x] Implement `whoami` command
- [x] Implement `chat` command (both local and cloud modes)
- [x] Add Ink-based terminal UI components
  - [x] ChatView component
  - [x] StatusBar component
  - [x] App component
  - [x] SessionList component
- [x] Implement `sessions` commands (list, new, delete, export)
- [x] Implement `memory` commands (search, stats)
- [x] Implement `config` commands (get, set)
- [x] Add MCP client for cloud mode (CloudSessionManager)
- [x] Add FileSessionManager for local mode
- [x] Implement GitHub OAuth device flow
- [x] Implement automatic mode detection (online/offline)
- [x] Add configuration file support (~/.duyetbot/config.json)
- [x] Write CLI tests (67 tests)
- [ ] Create npm package for distribution

**Output**: Published CLI tool (@duyetbot/cli) ✅

**Progress**: Phase 5 COMPLETE (2025-11-20). Created @duyetbot/cli package with: config management, AuthManager, FileSessionManager, CloudSessionManager, GitHub OAuth device flow (wired to login), Commander.js commands, Ink-based UI (ChatView, StatusBar, App, SessionList), memory commands (search, stats), auto mode detection. 67 tests passing. Total: 342 tests. npm package distribution pending.

---

### Phase 6: GitHub Bot Integration (5-6 days) 🔧 IN PROGRESS

**Goal**: Full GitHub App with @duyetbot mention support

**Tasks**:
- [x] Create apps/github-bot package
- [ ] Register GitHub App
- [x] Implement webhook verification
- [x] Create @duyetbot mention parser
- [x] Implement webhook handlers:
  - [x] issue_comment (mentions)
  - [x] pull_request_review_comment (PR mentions)
  - [x] issues (issue events)
  - [x] pull_request (PR events)
- [x] Create GitHub tool for agent
  - [x] get_pr, get_issue, get_diff
  - [x] create_comment, create_review
  - [x] add_labels, get_files, remove_labels
  - [x] create_issue, update_issue
  - [x] trigger_workflow, merge_pr
- [x] Implement session management (issue/PR → session mapping)
- [x] Add MCP client integration for memory
- [x] Create agent with GitHub context (system prompt builder)
- [x] Implement response posting
- [x] Add error handling and logging
- [x] Write GitHub bot tests (57 tests)
- [ ] Deploy GitHub App
- [ ] Document setup and usage

**Output**: Production GitHub bot ✅

**Progress**: Phase 6 NEARLY COMPLETE (2025-11-21). Created @duyetbot/github-bot package with: Hono server, mention parser (18 tests), webhook handlers (issue_comment, PR review comment, issues, pull_request), agent handler with system prompt builder and session management, GitHubSessionManager with MCP client integration, GitHub tool (14 actions including trigger_workflow, merge_pr, add/remove labels), webhook signature verification. 57 tests passing. GitHub App registration and deployment pending.

---

### Phase 7: Claude Code Agent SDK Integration (4-5 days) ✅ COMPLETED

**Goal**: Refactor core agent system to fully leverage Claude Code Agent SDK patterns

**Tasks**:
- [x] Refactor packages/core to use SDK's `query()` function pattern
  - [x] Replace custom agent execution with SDK query function
  - [x] Implement proper async generator message streaming
  - [x] Add support for both single-mode and streaming-mode inputs
- [x] Update tool system to use SDK's `tool()` function
  - [x] Migrate all tools to use Zod schema definitions via SDK
  - [x] Ensure type-safe tool handlers with structured results
  - [x] Update tool registry to export SDK-compatible tools
- [x] Implement SDK session management
  - [x] Use SDK's session ID, resume, and forkSession patterns
  - [ ] Integrate with existing FileSessionManager and CloudSessionManager
  - [x] Add session forking capability for parallel workflows
- [x] Add MCP server configuration via SDK
  - [x] Configure memory-mcp server as SDK MCP connection
  - [x] Support multiple MCP server types (stdio, SSE, HTTP)
  - [x] Add tool allowlists per MCP server
- [x] Implement subagent system using SDK's `agents` option
  - [x] Define subagents programmatically with descriptions
  - [x] Configure tool subsets per subagent
  - [x] Add custom prompts and model overrides per agent
  - [ ] Update GitHub bot and CLI to use subagent patterns
- [x] Add permission modes support
  - [x] Implement "default", "acceptEdits", "bypassPermissions" modes
  - [x] Add permission mode configuration per use case
  - [ ] Integrate with CLI and server configuration
- [x] Implement interrupt capability
  - [x] Add `interrupt()` method for streaming queries
  - [ ] Integrate with WebSocket server for real-time cancellation
  - [x] Add timeout and graceful shutdown handling
- [x] Update CLI to use SDK streaming
  - [x] Refactor chat command to use async generator streaming
  - [ ] Implement real-time message display with Ink
  - [x] Add interrupt support (Ctrl+C handling)
- [x] Update server to use SDK patterns
  - [x] Refactor execute endpoint to use query() function
  - [x] Implement proper streaming over WebSocket
  - [x] Add message type handling for all SDK message types
- [x] Integrate Anthropic API with SDK query
  - [x] Direct API calls with retry logic (exponential backoff)
  - [x] Tool execution with Zod validation
  - [x] Token usage and duration tracking
- [x] Write comprehensive SDK integration tests (50+ tests)
  - [x] Test query() function with various inputs
  - [x] Test tool execution with Zod schemas
  - [x] Test session management (resume, fork)
  - [x] Test MCP server integration
  - [x] Test subagent delegation
  - [x] Test permission modes
  - [x] Test interrupt capability
- [x] Update documentation
  - [x] Document SDK patterns used (ARCHITECTURE.md)
  - [x] Add execution flow diagram
  - [x] Document error handling and retry strategy
  - [ ] Add examples for custom tool creation
  - [ ] Document subagent configuration

**Progress**: Phase 7 COMPLETE (2025-11-21). Implemented:
- ✅ SDK integration layer (query.ts, tool.ts, options.ts, subagent.ts, types.ts)
- ✅ Anthropic API integration with retry logic (exponential backoff)
- ✅ Complete tool execution loop with Zod validation
- ✅ CLI chat with SDK streaming and interrupt support
- ✅ Token usage and duration tracking
- ✅ Architecture documentation with execution flow diagram
- ✅ Server SDK integration (execute endpoint, WebSocket streaming)
- ✅ Tool conversion adapter (toSDKTool, toSDKTools)
- 📝 Remaining: Ink real-time UI display

**Output**: Core agent system fully integrated with Claude Code Agent SDK patterns ✅

**Key SDK Patterns to Implement**:

```typescript
// Query function pattern
import { query, tool, Options } from '@anthropic-ai/claude-agent-sdk';

// Tool definition with Zod
const bashTool = tool(
  'bash',
  'Execute shell commands',
  z.object({ command: z.string() }),
  async ({ command }) => {
    // Execute and return result
    return { output: '...' };
  }
);

// Agent execution with SDK
const options: Options = {
  model: 'sonnet',
  tools: [bashTool, gitTool, githubTool],
  systemPrompt: 'You are @duyetbot...',
  permissionMode: 'default',
  mcpServers: [{
    type: 'http',
    url: 'https://memory.duyetbot.workers.dev',
  }],
  agents: [{
    name: 'researcher',
    description: 'Research and gather information',
    tools: ['research', 'web_search'],
    prompt: 'You are a research assistant...',
    model: 'haiku',
  }],
};

// Streaming query
for await (const message of query(userInput, options)) {
  if (message.type === 'assistant') {
    // Handle assistant response
    stream.write(message.content);
  }
}
```

---

## Claude Agent SDK as Core Engine - Architecture Design

### Overview

This section describes the architectural approach to make the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) the core engine of duyetbot-agent, replacing the custom agent implementation with the official SDK.

### Design Principles

1. **SDK-First**: Use Claude Agent SDK's `query()` as the primary execution engine
2. **Thin Wrapper**: Minimize abstraction layers between SDK and application code
3. **MCP Integration**: Connect duyetbot's memory server as an MCP server to the SDK
4. **Tool Compatibility**: Convert existing tools to SDK-compatible format
5. **Streaming Native**: Leverage SDK's async generator streaming throughout

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         duyetbot-agent System                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│   │   CLI App   │     │ GitHub Bot  │     │  Telegram   │               │
│   │  (packages/ │     │   (apps/    │     │   Bot       │               │
│   │    cli)     │     │ github-bot) │     │             │               │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘               │
│          │                   │                   │                       │
│          └───────────────────┼───────────────────┘                       │
│                              │                                           │
│                    ┌─────────▼──────────┐                               │
│                    │   Agent Runner     │                               │
│                    │  (packages/core)   │                               │
│                    │                    │                               │
│                    │  ┌──────────────┐  │                               │
│                    │  │ SDK Adapter  │  │   ← Thin adapter layer        │
│                    │  └──────┬───────┘  │                               │
│                    └─────────┼──────────┘                               │
│                              │                                           │
│    ┌─────────────────────────┼─────────────────────────┐                │
│    │                         │                         │                │
│    │         ╔═══════════════▼════════════════╗        │                │
│    │         ║   Claude Agent SDK (Core)      ║        │                │
│    │         ║   @anthropic-ai/claude-agent-  ║        │                │
│    │         ║              sdk               ║        │                │
│    │         ║                                ║        │                │
│    │         ║  • query() - main execution    ║        │                │
│    │         ║  • tool() - tool definitions   ║        │                │
│    │         ║  • Streaming via AsyncGen      ║        │                │
│    │         ║  • MCP server connections      ║        │                │
│    │         ║  • Subagent delegation         ║        │                │
│    │         ╚════════════════════════════════╝        │                │
│    │                         │                         │                │
│    └─────────────────────────┼─────────────────────────┘                │
│                              │                                           │
│          ┌───────────────────┼───────────────────┐                      │
│          │                   │                   │                      │
│    ┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐                │
│    │  Tools    │       │   MCP     │       │  Claude   │                │
│    │  (bash,   │       │  Memory   │       │   API     │                │
│    │  git,     │       │  Server   │       │           │                │
│    │  github)  │       │           │       │           │                │
│    └───────────┘       └───────────┘       └───────────┘                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. SDK Adapter (`packages/core/src/sdk-engine/`)

A thin adapter that configures and invokes the Claude Agent SDK:

```typescript
// packages/core/src/sdk-engine/engine.ts
import { query as sdkQuery, tool as sdkTool } from '@anthropic-ai/claude-agent-sdk';
import type { Options, Message } from '@anthropic-ai/claude-agent-sdk';

export interface DuyetbotConfig {
  // API configuration
  apiKey?: string;
  baseUrl?: string;
  model?: 'haiku' | 'sonnet' | 'opus' | string;

  // Memory MCP server
  memoryServerUrl?: string;

  // Tools
  tools?: SDKTool[];

  // Context
  systemPrompt?: string;
  sessionId?: string;

  // Subagents
  agents?: SubagentConfig[];
}

/**
 * Create SDK options from duyetbot config
 */
export function createSDKOptions(config: DuyetbotConfig): Options {
  const options: Options = {
    model: config.model || 'sonnet',
    systemPrompt: config.systemPrompt,
    tools: config.tools,
    agents: config.agents,
  };

  // Connect to MCP memory server
  if (config.memoryServerUrl) {
    options.mcpServers = [{
      type: 'http',
      url: config.memoryServerUrl,
      toolAllowlist: ['get_memory', 'save_memory', 'search_memory', 'list_sessions'],
    }];
  }

  // Session management
  if (config.sessionId) {
    options.sessionId = config.sessionId;
  }

  return options;
}

/**
 * Execute query using Claude Agent SDK
 */
export async function* executeQuery(
  input: string | AsyncIterable<UserMessage>,
  config: DuyetbotConfig
): AsyncGenerator<Message> {
  const options = createSDKOptions(config);

  // Direct passthrough to SDK
  yield* sdkQuery(input, options);
}

/**
 * Single-shot query execution
 */
export async function executeSingle(
  input: string,
  config: DuyetbotConfig
): Promise<Message> {
  const options = createSDKOptions(config);
  let result: Message | undefined;

  for await (const message of sdkQuery(input, options)) {
    if (message.type === 'result') {
      result = message;
    }
  }

  if (!result) {
    throw new Error('No result from query');
  }

  return result;
}
```

#### 2. Tool Conversion Layer

Convert existing duyetbot tools to SDK format:

```typescript
// packages/core/src/sdk-engine/tools.ts
import { tool as sdkTool } from '@anthropic-ai/claude-agent-sdk';
import { bashTool, gitTool, planTool, researchTool } from '@duyetbot/tools';

/**
 * Convert duyetbot tool to SDK tool
 */
export function toSDKTool(duyetbotTool: DuyetbotTool): SDKTool {
  return sdkTool(
    duyetbotTool.name,
    duyetbotTool.description,
    duyetbotTool.inputSchema,
    async (input) => {
      const result = await duyetbotTool.execute({ content: input });
      return {
        content: result.content,
        isError: result.status !== 'success',
      };
    }
  );
}

/**
 * Get all duyetbot tools as SDK tools
 */
export function getAllSDKTools(): SDKTool[] {
  return [
    toSDKTool(bashTool),
    toSDKTool(gitTool),
    toSDKTool(planTool),
    toSDKTool(researchTool),
    // GitHub tool requires context, created per-request
  ];
}
```

#### 3. Application Layer Integration

##### CLI Application

```typescript
// packages/cli/src/commands/chat.ts
import { executeQuery, createSDKOptions } from '@duyetbot/core/sdk-engine';
import { getAllSDKTools } from '@duyetbot/core/sdk-engine/tools';

export async function chatCommand(options: ChatOptions) {
  const config: DuyetbotConfig = {
    model: options.model || 'sonnet',
    memoryServerUrl: options.cloudMode
      ? 'https://memory.duyetbot.workers.dev'
      : undefined,
    tools: getAllSDKTools(),
    systemPrompt: 'You are duyetbot, a helpful AI assistant.',
    sessionId: options.sessionId,
  };

  // Stream responses to terminal
  for await (const message of executeQuery(userInput, config)) {
    switch (message.type) {
      case 'assistant':
        process.stdout.write(message.content);
        break;
      case 'tool_use':
        console.log(`\nUsing tool: ${message.toolName}`);
        break;
      case 'result':
        console.log(`\nCompleted (${message.totalTokens} tokens)`);
        break;
    }
  }
}
```

##### GitHub Bot

```typescript
// apps/github-bot/src/handlers/mention.ts
import { executeQuery } from '@duyetbot/core/sdk-engine';
import { getAllSDKTools, createGitHubTool } from '@duyetbot/core/sdk-engine/tools';

export async function handleMention(event: GitHubMentionEvent) {
  const { repository, issue, comment } = event;

  // Create GitHub-specific tool with context
  const githubTool = createGitHubTool(octokit, repository);

  const config: DuyetbotConfig = {
    model: 'sonnet',
    memoryServerUrl: process.env.MCP_MEMORY_URL,
    tools: [...getAllSDKTools(), githubTool],
    systemPrompt: buildGitHubSystemPrompt(repository, issue),
    sessionId: `github:${repository.full_name}:${issue.number}`,
    agents: [
      {
        name: 'code_reviewer',
        description: 'Review code for quality and issues',
        tools: ['bash', 'git', 'github'],
        model: 'sonnet',
      },
      {
        name: 'researcher',
        description: 'Research and gather information',
        tools: ['research'],
        model: 'haiku',
      },
    ],
  };

  // Collect full response
  let response = '';
  for await (const message of executeQuery(comment.body, config)) {
    if (message.type === 'assistant') {
      response += message.content;
    }
  }

  // Post response as comment
  await octokit.issues.createComment({
    owner: repository.owner.login,
    repo: repository.name,
    issue_number: issue.number,
    body: response,
  });
}
```

##### Long-Running Server

```typescript
// apps/agent-server/src/agent-runner.ts
import { executeQuery, createQueryController } from '@duyetbot/core/sdk-engine';

export class AgentRunner {
  private activeQueries = new Map<string, QueryController>();

  async execute(sessionId: string, input: string, ws: WebSocket) {
    const controller = createQueryController();
    this.activeQueries.set(sessionId, controller);

    const config: DuyetbotConfig = {
      model: 'sonnet',
      memoryServerUrl: process.env.MCP_MEMORY_URL,
      tools: getAllSDKTools(),
      sessionId,
    };

    try {
      for await (const message of executeQuery(input, config, controller)) {
        // Stream to WebSocket
        ws.send(JSON.stringify(message));

        if (message.type === 'result') {
          break;
        }
      }
    } finally {
      this.activeQueries.delete(sessionId);
    }
  }

  interrupt(sessionId: string) {
    const controller = this.activeQueries.get(sessionId);
    if (controller) {
      controller.interrupt();
    }
  }
}
```

### MCP Memory Integration

The memory MCP server (`apps/memory-mcp`) becomes a first-class MCP server that the SDK connects to:

```typescript
// SDK automatically calls MCP server tools
const config: DuyetbotConfig = {
  memoryServerUrl: 'https://memory.duyetbot.workers.dev',
  // SDK can now use: get_memory, save_memory, search_memory, list_sessions
};
```

The agent can naturally reference memory in conversations:
- "Search my previous conversations about React hooks"
- "Save this solution to memory for later"
- "What did we discuss last time about deployment?"

### Subagent Delegation

SDK handles subagent routing automatically:

```typescript
const config: DuyetbotConfig = {
  agents: [
    {
      name: 'researcher',
      description: 'Research topics and gather information',
      tools: ['research', 'web_search'],
      prompt: 'You are a research assistant. Provide comprehensive, well-sourced information.',
      model: 'haiku',
    },
    {
      name: 'code_reviewer',
      description: 'Review code for quality, security, and best practices',
      tools: ['bash', 'git'],
      prompt: 'You are a code reviewer. Focus on bugs, security issues, and improvements.',
      model: 'sonnet',
    },
  ],
};

// When user says "research the best practices for error handling"
// SDK automatically delegates to the researcher subagent
```

### Migration Steps

1. **Phase 7.1**: Create `sdk-engine` module with thin adapter
2. **Phase 7.2**: Convert existing tools to SDK format
3. **Phase 7.3**: Update CLI to use SDK directly
4. **Phase 7.4**: Update GitHub bot to use SDK
5. **Phase 7.5**: Update server to use SDK
6. **Phase 7.6**: Remove old Agent class (deprecated)
7. **Phase 7.7**: Update tests to use SDK patterns

### Benefits

1. **Reduced Complexity**: Remove custom agent loop, rely on SDK
2. **Feature Parity**: Get all SDK features (streaming, tools, subagents, MCP)
3. **Maintenance**: SDK updates automatically improve duyetbot
4. **Reliability**: Battle-tested execution engine
5. **Consistency**: Same patterns across CLI, server, and bots

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Adapter thickness** | Thin (config only) | Maximize SDK features, minimize maintenance |
| **Tool format** | SDK native | Use `tool()` function directly |
| **Memory access** | MCP server | SDK's native MCP support |
| **Session management** | SDK + MCP | Session ID passed to SDK, persisted via MCP |
| **Error handling** | SDK-managed | Let SDK handle retries and errors |

### File Structure

```
packages/core/src/
├── sdk-engine/
│   ├── index.ts           # Main exports
│   ├── engine.ts          # Query execution using SDK
│   ├── tools.ts           # Tool conversion and registry
│   ├── config.ts          # Configuration helpers
│   └── subagents.ts       # Predefined subagent configs
├── agent/                  # DEPRECATED - to be removed
├── mcp/                    # MCP client (for direct calls if needed)
└── sdk/                    # Current wrapper - to be replaced
```

---

### Phase 8: Telegram Bot Integration (3-4 days) 🔧 IN PROGRESS

**Goal**: Telegram bot using Cloudflare Agents SDK on Workers

**Architecture**: Uses Cloudflare Agents SDK with Durable Objects for stateful agent sessions. Each user gets a unique agent instance with built-in SQLite storage.

**Tasks**:
- [x] Create apps/telegram-bot package
- [x] Register Telegram bot
- [x] Refactor to Cloudflare Agents SDK
  - [x] Install dependencies (agents, @ai-sdk/openai)
  - [x] Create provider abstraction (OpenRouter via AI Gateway)
  - [x] Implement chat agent with tool support
  - [ ] Connect to memory-mcp as MCP client
- [x] Implement commands:
  - [x] /start
  - [x] /help
  - [x] /clear
- [x] Configure wrangler.toml for duyetbot-telegram
  - [x] Add environment variables
  - [x] Configure AI Gateway integration
- [x] Create packages/prompts for shared prompts
  - [x] telegram.md - Telegram bot personality
  - [x] github.md - GitHub bot personality
  - [x] default.md - Base fragments
- [x] Create packages/chat-agent for reusable agent abstraction
  - [x] ChatAgent base class
  - [x] CloudflareAgentAdapter
  - [x] Factory function
- [ ] Write Telegram bot tests (25+ tests)
- [ ] Deploy to Cloudflare Workers (duyetbot-telegram)
- [ ] Document usage

**Key Features**:
- Cloudflare AI Gateway for LLM access (OpenRouter)
- Reusable chat-agent package
- Shared prompts via packages/prompts
- Session persistence via Durable Objects

**Output**: Production Telegram bot on Cloudflare Workers ✅

**Progress**: Core implementation complete (2025-11-23). Created packages/chat-agent and packages/prompts. Telegram bot refactored to use AI Gateway and chat-agent. Testing and deployment pending.

---

### Phase 9: API Gateway (3-4 days)

**Goal**: HTTP API for web UI and external integrations

**Tasks**:
- [ ] Create apps/api package
- [ ] Set up Hono framework
- [ ] Create route structure:
  - [ ] /agent/* (chat, execute, stream)
  - [ ] /github/* (webhook handlers)
  - [ ] /telegram/* (webhook handlers)
  - [ ] /health/* (health checks)
- [ ] Implement authentication middleware (GitHub token verification)
- [ ] Add rate limiting middleware
- [ ] Add CORS middleware
- [ ] Create request/response logging
- [ ] Add error handling
- [ ] Implement SSE streaming for real-time responses
- [ ] Write API tests (35+ tests)
- [ ] Document API endpoints
- [ ] Deploy API gateway

**Output**: Production API gateway ✅

---

### Phase 10: Integration & Testing (4-5 days)

**Goal**: End-to-end testing and integration

**Tasks**:
- [ ] Write integration tests:
  - [ ] CLI → MCP Server → D1/KV
  - [ ] Agent Server → MCP Server
  - [ ] GitHub Bot → Agent Server → MCP Server
  - [ ] Telegram Bot → Agent Server → MCP Server
- [ ] Test full @duyetbot workflow on GitHub
- [ ] Test Telegram bot workflow
- [ ] Test CLI local and cloud modes
- [ ] Performance testing (latency, throughput)
- [ ] Load testing (concurrent sessions)
- [ ] Security audit
- [ ] Fix issues and bugs
- [ ] Optimize performance
- [ ] Update documentation

**Output**: Fully tested system ✅

---

### Phase 11: Documentation & Deployment (2-3 days) 🔧 IN PROGRESS

**Goal**: Production deployment and documentation

**Tasks**:
- [ ] Update README.md with new architecture
- [ ] Update ARCHITECTURE.md with detailed design
- [ ] Write deployment guide
  - [ ] MCP server deployment (Cloudflare Workers)
  - [ ] Agent server deployment (Docker/K8s)
  - [ ] GitHub App setup
  - [ ] Telegram bot setup
- [ ] Write user guide
  - [ ] CLI usage
  - [ ] GitHub integration
  - [ ] Telegram bot usage
- [ ] Create example configurations
- [ ] Write troubleshooting guide
- [x] Set up CI/CD pipelines
  - [x] .github/workflows/ci.yml (lint, typecheck, test, build, integration tests)
  - [ ] .github/workflows/deploy-mcp.yml
  - [ ] .github/workflows/deploy-server.yml
- [ ] Deploy all components to production
- [ ] Monitor and verify

**Output**: Production deployment with documentation

**Progress**: CI workflow created (2025-11-21). GitHub Actions pipeline with lint, typecheck, test, build, and integration test jobs.

---

## Migration from Current Architecture

### Current State
- Cloudflare Workers-based (single package)
- 60% MVP complete (507 tests passing)
- Core agent system ✅
- Multi-provider LLM ✅
- Tools system ✅
- Local file storage ✅
- OAuth authentication ✅

### Migration Strategy

**Phase 1: Keep Existing Code Working**
- Don't delete existing code immediately
- Create new monorepo structure alongside
- Gradually move code to new packages
- Maintain all existing tests

**Phase 2: Incremental Refactoring**
1. Set up monorepo (Phase 1)
2. Move providers → packages/providers (maintain tests)
3. Move tools → packages/tools (maintain tests)
4. Move core → packages/core (maintain tests)
5. Build MCP server (new)
6. Build agent server (new)
7. Build CLI (refactor existing)
8. Build GitHub/Telegram bots (new)

**Phase 3: Deprecation**
1. Once all components working in new architecture
2. Remove old Cloudflare Workers code
3. Update documentation
4. Archive old structure

---

## Success Metrics

### Technical Metrics
- [ ] All existing 507+ tests still passing
- [ ] Agent response time < 2s (p95)
- [ ] MCP server latency < 100ms (p95)
- [ ] CLI startup time < 500ms
- [ ] GitHub mention response < 10s
- [ ] Test coverage > 80%

### Functional Metrics
- [ ] @duyetbot responds to GitHub mentions
- [ ] Telegram bot functional
- [ ] CLI works in local and cloud modes
- [ ] MCP memory server stores/retrieves sessions
- [ ] Multi-provider support works (Claude, Z.AI via base URL, OpenRouter)
- [ ] Container deployment successful

---

## Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Orchestration** | Cloudflare Workflows | Durable execution, free sleep (365 days), built-in retries |
| **Compute** | Fly.io Machines | Full Linux, fast boot (~2s), API-driven lifecycle |
| **State Persistence** | Fly.io Volumes | NVMe storage, Volume-as-Session pattern |
| **Monorepo** | pnpm workspaces + Turborepo | Fast, efficient, great TypeScript support |
| **Agent Engine** | Claude Agent SDK | Battle-tested, maintained by Anthropic |
| **MCP Memory Server** | Cloudflare Workers + D1 + KV | Edge deployment, cross-session search |
| **Feedback Loop** | GitHub Checks API | Real-time streaming, HITL via action_required |
| **CLI** | Node.js + Ink + Commander | Cross-platform, rich terminal UI |
| **GitHub Bot** | Hono + Octokit | Webhook handling, GitHub API |
| **Telegram Bot** | Telegraf | Best TypeScript bot framework |
| **Testing** | Vitest | Fast, modern, great DX |
| **LLM** | Claude/Z.AI/OpenRouter | Claude-compatible APIs only |
| **Protocol** | MCP | Standardized tool/resource protocol |

---

## Development Workflow

### Commit Message Guidelines

**Always use semantic commit format with simple English. Do NOT uppercase the message after the semantic prefix.**

**Format**: `<type>: <description in lowercase>`

**Correct Examples**:
```bash
git commit -m "feat: add file-based session storage"
git commit -m "fix: resolve git tool error handling"
git commit -m "docs: update PLAN.md with phase 3 progress"
git commit -m "test: add storage integration tests"
git commit -m "refactor: simplify provider factory logic"
git commit -m "chore: update dependencies"
```

**Semantic Types**:
- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation changes
- `test`: adding or updating tests
- `refactor`: code refactoring
- `perf`: performance improvements
- `chore`: maintenance tasks
- `ci`: CI/CD changes
- `build`: build system changes

### Monorepo Commands

```bash
# Install all dependencies
bun install

# Build all packages
bun run build

# Test all packages
bun run test

# Test specific package
bun run test --filter @duyetbot/core

# Build specific package
bun run build --filter @duyetbot/memory-mcp

# Add dependency to package
cd packages/core
pnpm add zod

# Add dev dependency
pnpm add -D vitest --filter @duyetbot/core

# Run CLI locally
bun --filter @duyetbot/cli dev

# Deploy MCP server
bun --filter @duyetbot/memory-mcp deploy

# Start agent server locally
bun --filter @duyetbot/agent-server dev

# Watch mode for all packages
bun run dev
```

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-23 | 3.20 | 🏗️ **TWO-TIER ARCHITECTURE**: Clarified two-tier agent system: Tier 1 (Cloudflare Agents - lightweight, Workers) for quick responses and triggering workflows; Tier 2 (Claude Agent SDK - heavy, containers) for long-running tasks. Created packages/chat-agent for reusable chat agent abstraction. Created packages/prompts with markdown prompt files. Refactored telegram-bot to use AI Gateway. Updated docs/architecture.md with two-tier documentation. |
| 2025-11-22 | 3.19 | 🏗️ **CLOUDFLARE AGENTS SDK REFACTOR**: Refactoring Workers apps to use Cloudflare Agents SDK instead of custom implementations. telegram-bot and github-bot will use Durable Objects for stateful sessions. Added SDK Choices table. Created packages/prompts for shared prompts. Deployment targets: duyetbot-telegram, duyetbot-github, duyetbot-memory-mcp (all via wrangler). agent-server continues to use Claude Agent SDK on containers. |
| 2025-11-21 | 3.18 | 🔧 **Phases 8-11 IN PROGRESS**: Phase 8 (Telegram Bot), Phase 9 (API Gateway), Phase 10 (Integration Tests), Phase 11 (CI/CD workflow). Created .github/workflows/ci.yml with lint, typecheck, test, build, and integration test jobs. 515 tests passing (494 unit + 21 integration). |
| 2025-11-21 | 3.17 | 🏗️ **ARCHITECTURE UPDATE**: Updated to Hybrid Supervisor-Worker Model based on durable execution research. Cloudflare Workflows as Supervisor (orchestration, state, HITL), Fly.io Machines as Worker (compute, filesystem, SDK). Added Volume-as-Session pattern for state persistence. Human-in-the-Loop via GitHub Checks API action_required. Cost model: ~$3.66/mo vs $58/mo always-on. Updated docs/architecture.md and PLAN.md. |
| 2025-11-21 | 3.16 | ✅ **Phase 7 COMPLETE**: Server SDK integration implemented. Updated /execute endpoint to use SDK query() function. WebSocket handleChat now streams SDK messages (assistant, tool_use, tool_result, tokens). Created sdk-adapter.ts with toSDKTool/toSDKTools for tool conversion, executeQuery/streamQuery helpers, and createQueryController for interruption. Added AgentRoutesConfig and WebSocketConfig for tool/prompt/model configuration. All 443+ tests passing. |
| 2025-11-21 | 3.15 | 🏗️ **Monorepo Refactor**: World-class monorepo structure. Removed legacy /src/, duplicate /packages/mcp-memory/. Created shared config packages (@duyetbot/config-typescript, @duyetbot/config-vitest). Added pnpm catalog for dependency version sync. Updated all package.json files to use catalog: references. Standardized exports, added clean scripts, removed src from files field. Updated turbo.json with proper task definitions. Fixed root tsconfig - removed legacy path aliases. |
| 2025-11-21 | 3.14 | 🔧 **Phase 7 NEARLY COMPLETE**: Integrated Anthropic API with SDK query - direct API calls with retry logic (exponential backoff), complete tool execution loop with Zod validation, CLI chat with SDK streaming and interrupt support (Ctrl+C), token usage and duration tracking. Updated ARCHITECTURE.md with SDK execution flow diagram, error handling strategy, environment configuration. 443 tests passing. Remaining: Server SDK integration, Ink UI. |
| 2025-11-21 | 3.13 | 🔧 **Phase 7 IN PROGRESS**: SDK integration layer implemented. Created packages/core/src/sdk with: query() function with async generator streaming, sdkTool() with Zod schemas, QueryOptions (model, permissions, MCP, subagents), SubagentRegistry with 5 predefined agents (researcher, codeReviewer, planner, gitOperator, githubAgent), permission modes, interrupt capability with QueryController. 44 SDK tests passing (101 total core tests). CLI/server integration pending. |
| 2025-11-21 | 3.12 | 🆕 **Added Phase 7 - Claude Code Agent SDK Integration**: New phase to fully leverage SDK patterns (query() function, tool() with Zod, session management with resume/fork, MCP server config, subagents, permission modes, interrupt capability). Updated phase numbering (7→8→9→10→11). Removed OpenAI provider - focusing on Claude-compatible APIs only (Claude, Z.AI, OpenRouter). |
| 2025-11-21 | 3.11 | 🔧 **Phase 6 NEARLY COMPLETE**: Added webhook handlers for issues and pull_request events, trigger_workflow and other GitHub tool actions (14 total), GitHubSessionManager with MCP client integration for persistent sessions, comprehensive tests. 57 github-bot tests passing. GitHub App registration and deployment pending. |
| 2025-11-20 | 3.10 | 🔧 **Phase 6 IN PROGRESS**: GitHub bot core implementation. Created @duyetbot/github-bot with Hono server, mention parser (18 tests), webhook handlers, agent handler with system prompt builder, GitHub tool (6 actions), webhook signature verification. 365 tests passing (23 new). |
| 2025-11-20 | 3.9 | ✅ **Phase 5 COMPLETE**: Wired login command to GitHubDeviceAuth, added memory commands (search, stats), created SessionList UI component, implemented auto mode detection (mode-detector.ts). 342 tests passing (67 CLI tests). npm package distribution pending. |
| 2025-11-20 | 3.8 | 🔧 **Phase 5 IN PROGRESS**: Added Ink-based terminal UI (ChatView, StatusBar, App), CloudSessionManager with MCP client, GitHub OAuth device flow. Fixed tsconfig issues across packages. 342 tests passing (67 CLI tests). SessionList and npm distribution pending. |
| 2025-11-20 | 3.7 | 🔧 **Phase 5 IN PROGRESS**: CLI package created. @duyetbot/cli with: config management, AuthManager, FileSessionManager, Commander.js commands (login, logout, whoami, chat, sessions, config). 315 tests passing (40 new CLI tests). Ink UI pending. |
| 2025-11-20 | 3.6 | ✅ **Phase 4 COMPLETE**: Long-Running Agent Server implemented. Created @duyetbot/agent-server package with: config system, AgentSessionManager, health routes, agent API routes (sessions, execute), WebSocket server for streaming, graceful shutdown. Dockerfiles for server and mcp-memory. docker-compose.yml for deployment. 275 tests passing (36 new server tests). |
| 2025-11-20 | 3.5 | ✅ **Phase 3 COMPLETE**: Added comprehensive tests for all packages. 239 tests passing: 93 memory-mcp + 38 providers (factory, claude) + 51 tools (registry, sleep) + 57 core (session manager, MCP client). |
| 2025-11-20 | 3.4 | 🔧 **Phase 3 IN PROGRESS**: Added MCP client integration to core package. MCPMemoryClient class for memory server operations (authenticate, getMemory, saveMemory, searchMemory, listSessions). Tests pending. |
| 2025-11-20 | 3.3 | 🔧 **Phase 3 IN PROGRESS**: Refactored providers with base URL override support. Added createZAIConfig and createProviderConfig helpers for Z.AI support. Created GitHub tool with 10 actions (get_pr, get_issue, create_comment, etc.). All packages building successfully. |
| 2025-11-20 | 3.2 | 🔧 **Phase 2 IN PROGRESS**: MCP Memory Server core implementation complete. Created @duyetbot/memory-mcp package with: Hono HTTP API, D1Storage and KVStorage classes, 5 MCP tools (authenticate, get_memory, save_memory, search_memory, list_sessions), rate limiting, GitHub token auth. 93 tests passing. Deployment pending. |
| 2025-11-19 | 3.1 | ✅ **Phase 1 COMPLETE**: Monorepo setup with pnpm workspaces + Turborepo. Created packages: @duyetbot/types, @duyetbot/providers, @duyetbot/tools, @duyetbot/core. Migrated existing code from src/ to packages. Updated imports to use workspace packages. All packages building successfully. |
| 2025-11-19 | 3.0 | 🚀 **MAJOR REDESIGN**: Complete architectural overhaul. Moved from Cloudflare Workers-only to monorepo with long-running container server + MCP memory layer. Added GitHub bot (@duyetbot mentions), Telegram bot, multi-provider with base URL override (Z.AI support), separated packages (core, providers, tools, memory-mcp, server, CLI), Docker deployment. Comprehensive 10-phase implementation plan. Previous architecture preserved in git history. |
| 2025-11-18 | 2.3 | ✅ **Phase 9.1 COMPLETE**: Research Tool implemented (24 tests). 663 tests total (655 passing, 98.8%). |
| 2025-11-18 | 2.2 | ✅ **Phase 8 COMPLETE**: Multi-tenant database layer (88 tests). 560 tests total (552 passing, 98.6%). |
| 2025-11-18 | 2.1 | ✅ **Phase 5 COMPLETE**: Central API & Authentication (507 tests passing). |
| 2025-11-18 | 2.0 | 🚀 **MAJOR ARCHITECTURE REDESIGN**: Multi-tenant centralized platform. Added ARCHITECTURE.md. |
| 2025-11-18 | 1.9 | 🎯 **Architecture Pivot**: Changed to local desktop app with file storage. |
| 2025-11-18 | 1.0 | Initial plan created. |

---

## Next Steps

1. ✅ Review and approve this redesigned plan
2. ✅ **Phase 1 - Monorepo Setup** COMPLETE
3. 🔧 **Phase 2 - MCP Memory Server** IN PROGRESS
   - [x] Core implementation complete (93 tests)
   - [ ] Deploy to Cloudflare Workers
   - [ ] Document MCP API
4. ✅ **Phase 3 - Refactor Core Packages** COMPLETE
   - [x] Providers with base URL support
   - [x] GitHub tool created
   - [x] Write tests (239 total tests passing)
   - [x] Add MCP client integration to core
5. ✅ **Phase 4 - Long-Running Agent Server** COMPLETE
   - [x] Server package with config, session manager, routes
   - [x] WebSocket server for streaming
   - [x] Graceful shutdown handling
   - [x] Docker and docker-compose configurations
   - [x] 36 tests passing (275 total)
6. ✅ **Phase 5 - CLI with MCP Integration** COMPLETE
   - [x] CLI package with config, auth, sessions
   - [x] Commander.js commands with login wired to GitHubDeviceAuth
   - [x] FileSessionManager for local mode
   - [x] SessionList UI component
   - [x] Memory commands (search, stats)
   - [x] Auto mode detection
   - [x] 67 tests passing (342 total)
   - [ ] npm package distribution
7. 🔧 **Phase 6 - GitHub Bot Integration** NEARLY COMPLETE
   - [x] Create apps/github-bot package
   - [x] Implement @duyetbot mention parser
   - [x] Create webhook handlers (issues, pull_request, comments)
   - [x] Session management with MCP client integration
   - [x] GitHub tool (14 actions)
   - [x] 57 tests passing
   - [ ] Register GitHub App (external setup)
   - [ ] Deploy GitHub App
   - [ ] Document setup and usage
8. ✅ **Phase 7 - Claude Code Agent SDK Integration** COMPLETE
   - [x] Refactor core to use SDK's `query()` function pattern
   - [x] Update tools to use SDK's `tool()` function with Zod
   - [x] Implement SDK session management (resume, fork)
   - [x] Add MCP server configuration via SDK
   - [x] Implement subagent system using SDK's `agents` option
   - [x] Add permission modes and interrupt capability
   - [x] Update CLI and server to use SDK streaming
   - [x] Write SDK integration tests (50+ tests)
9. 🔧 **Phase 8 - Telegram Bot Integration** IN PROGRESS
   - [x] Create packages/chat-agent for reusable agent abstraction
   - [x] Create packages/prompts for shared prompts
   - [x] Refactor telegram-bot to use AI Gateway
   - [ ] Write tests
   - [ ] Deploy to Cloudflare Workers
10. **Phase 9 - API Gateway**
11. **Phase 10 - Integration & Testing**
12. **Phase 11 - Documentation & Deployment**

---

**This plan represents a fundamental architectural shift toward a more flexible, scalable, and maintainable system. All existing code and tests will be preserved during migration.**
