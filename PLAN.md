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

### High-Level System Design

```
┌──────────────────────────────────────────────────────────────────┐
│                        User Interactions                          │
├────────────────┬────────────────┬──────────────┬─────────────────┤
│ GitHub @mentions│ Telegram Bot   │  CLI Tool    │ Web UI (future) │
└────────┬───────┴────────┬───────┴──────┬───────┴─────────────────┘
         │                │              │
         │                │              │
    ┌────▼────────────────▼──────────────▼─────┐
    │       HTTP API Gateway (Hono)             │
    │   - Authentication (GitHub user context)  │
    │   - Rate limiting                         │
    │   - Request routing                       │
    └────────────────────┬──────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐     ┌────▼────┐    ┌────▼────────┐
    │ GitHub  │     │Telegram │    │   Agent     │
    │  Bot    │     │  Bot    │    │   Server    │
    │ Handler │     │ Handler │    │ (Container) │
    └────┬────┘     └────┬────┘    └──────┬──────┘
         │               │                 │
         └───────────────┼─────────────────┘
                         │
              ┌──────────▼──────────┐
              │  MCP Memory Server   │
              │ (Cloudflare Workers)│
              ├──────────────────────┤
              │ • Authentication     │
              │ • Session Storage    │
              │ • Message History    │
              │ • Vector Search      │
              └──────────┬───────────┘
                         │
         ┌───────────────┼────────────────┐
         │               │                │
    ┌────▼────┐    ┌────▼────┐      ┌────▼────┐
    │   D1    │    │   KV    │      │Vectorize│
    │(Metadata)│    │(Messages)│      │ (Search)│
    └─────────┘    └─────────┘      └─────────┘
```

### Key Architectural Changes

| Component | Old Design | New Design | Rationale |
|-----------|------------|------------|-----------|
| **Main Runtime** | Cloudflare Workers | Node.js/Bun Container | Long-running stateful sessions, no CPU limits |
| **Memory Layer** | KV + D1 directly | MCP Server (CF Workers) | Standardized protocol, reusable across clients |
| **Project Structure** | Single package | Monorepo (pnpm) | Separated concerns, independent deployments |
| **CLI** | Planned | Full-featured with MCP | Local execution + cloud memory access |
| **Provider System** | Fixed providers | Base URL override support | Flexible (Z.AI, custom endpoints) |
| **GitHub Integration** | Webhook parsing only | Full bot with @mentions | Complete automation for @duyet |
| **Telegram** | Not planned | Full bot integration | Communication and notifications |

---

## Monorepo Structure (pnpm Workspaces)

```
duyetbot-agent/
├── packages/
│   ├── core/                       # Core agent logic
│   │   ├── src/
│   │   │   ├── agent/             # Agent orchestration
│   │   │   ├── session/           # Session management
│   │   │   └── types/             # Shared types
│   │   └── package.json
│   │
│   ├── providers/                  # LLM provider abstractions
│   │   ├── src/
│   │   │   ├── base.ts            # Base provider interface
│   │   │   ├── claude.ts          # Claude provider
│   │   │   ├── openai.ts          # OpenAI provider
│   │   │   ├── openrouter.ts      # OpenRouter provider
│   │   │   ├── zai.ts             # Z.AI provider (base URL override)
│   │   │   └── factory.ts         # Provider factory with URL override
│   │   └── package.json
│   │
│   ├── tools/                      # Tool implementations
│   │   ├── src/
│   │   │   ├── bash.ts
│   │   │   ├── git.ts
│   │   │   ├── github.ts          # GitHub API operations (NEW)
│   │   │   ├── research.ts
│   │   │   ├── plan.ts
│   │   │   ├── sleep.ts
│   │   │   └── registry.ts
│   │   └── package.json
│   │
│   ├── memory-mcp/                 # MCP server for memory (Cloudflare Workers)
│   │   ├── src/
│   │   │   ├── index.ts           # Worker entry point
│   │   │   ├── mcp-server.ts      # MCP protocol implementation
│   │   │   ├── tools/             # MCP tools
│   │   │   │   ├── get_memory.ts
│   │   │   │   ├── save_memory.ts
│   │   │   │   ├── search_memory.ts
│   │   │   │   └── authenticate.ts
│   │   │   ├── storage/
│   │   │   │   ├── d1.ts          # D1 operations
│   │   │   │   ├── kv.ts          # KV operations
│   │   │   │   └── vectorize.ts   # Vector search
│   │   │   └── auth/
│   │   │       └── github.ts      # GitHub user verification
│   │   ├── wrangler.toml
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
  type: 'anthropic' | 'openai' | 'openrouter' | 'custom';
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
      case 'openai':
        return new OpenAIProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl || 'https://api.openai.com/v1',
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
// packages/memory-mcp/src/mcp-server.ts
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
// packages/server/src/index.ts
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
CMD ["bun", "run", "packages/server/src/index.ts"]
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
- [x] Run pnpm install
- [x] Build all packages successfully with turbo

**Output**: Working monorepo with build system ✅

**Completed**: 2025-11-19

---

### Phase 2: MCP Memory Server (4-5 days) ✅ IN PROGRESS

**Goal**: Implement MCP server on Cloudflare Workers with D1 + KV storage

**Tasks**:
- [x] Create packages/memory-mcp package
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

### Phase 3: Refactor Core Packages (3-4 days) ✅ IN PROGRESS

**Goal**: Extract and refactor existing code into monorepo packages

**Tasks**:
- [x] Move src/providers/ → packages/providers/
  - [x] Refactor ClaudeProvider with base URL override support
  - [x] Refactor OpenRouterProvider
  - [x] Create Z.AI provider helper (createZAIConfig, createProviderConfig)
  - [x] Update ProviderFactory to support base URL config
  - [ ] Add provider configuration loader
  - [ ] Write provider tests (maintain 102 existing tests)
- [x] Move src/tools/ → packages/tools/
  - [x] Extract bash, git, plan, sleep, research tools
  - [x] Create new `github` tool for GitHub API operations
  - [x] Add ToolRegistry
  - [ ] Write tool tests (maintain 151 existing tests)
- [x] Move src/agent/ → packages/core/
  - [x] Extract Agent core
  - [x] Extract Session management
  - [x] Add MCP client integration for memory
  - [ ] Write core tests (maintain 79 existing tests)
- [x] Update import paths across all packages
- [ ] Run all tests (maintain 507+ passing tests)

**Output**: Modular packages with maintained test coverage ✅

**Progress**: Base URL override support and Z.AI helpers added to providers (2025-11-20). GitHub tool created with 10 actions. MCP client added to core package. Tests pending - current total 93 tests in memory-mcp package.

---

### Phase 4: Long-Running Agent Server (5-6 days)

**Goal**: Build containerized server with WebSocket support

**Tasks**:
- [ ] Create packages/server package
- [ ] Implement server entry point
- [ ] Add MCP client for memory server connection
- [ ] Implement AgentSessionManager (in-memory + MCP persistence)
- [ ] Create WebSocket server for streaming
- [ ] Add HTTP API for /execute endpoint
- [ ] Implement session lifecycle management
- [ ] Add graceful shutdown handling
- [ ] Create health check endpoints
- [ ] Write Dockerfile for deployment
- [ ] Write docker-compose.yml for local dev
- [ ] Add server configuration system
- [ ] Write server tests (40+ tests)
- [ ] Document deployment process

**Output**: Production-ready agent server ✅

---

### Phase 5: CLI with MCP Integration (4-5 days)

**Goal**: Full-featured CLI with cloud and local modes

**Tasks**:
- [ ] Create packages/cli package
- [ ] Set up Commander.js command structure
- [ ] Implement `login` command (GitHub OAuth device flow)
- [ ] Implement `logout` command
- [ ] Implement `whoami` command
- [ ] Implement `chat` command (both local and cloud modes)
- [ ] Add Ink-based terminal UI components
  - [ ] ChatView component
  - [ ] StatusBar component
  - [ ] SessionList component
- [ ] Implement `sessions` commands (list, new, resume, delete, export)
- [ ] Implement `memory` commands (search, stats)
- [ ] Implement `config` commands (get, set, edit)
- [ ] Add MCP client for cloud mode
- [ ] Add FileSessionManager for local mode
- [ ] Implement automatic mode detection (online/offline)
- [ ] Add configuration file support (~/.duyetbot/config.json)
- [ ] Write CLI tests (50+ tests)
- [ ] Create npm package for distribution

**Output**: Published CLI tool (@duyetbot/cli) ✅

---

### Phase 6: GitHub Bot Integration (5-6 days)

**Goal**: Full GitHub App with @duyetbot mention support

**Tasks**:
- [ ] Create apps/github-bot package
- [ ] Register GitHub App
- [ ] Implement webhook verification
- [ ] Create @duyetbot mention parser
- [ ] Implement webhook handlers:
  - [ ] issue_comment (mentions)
  - [ ] pull_request_review_comment (PR mentions)
  - [ ] issues (issue events)
  - [ ] pull_request (PR events)
- [ ] Create GitHub tool for agent
  - [ ] get_pr, get_issue, get_diff
  - [ ] create_comment, create_review
  - [ ] create_issue, update_issue
  - [ ] trigger_workflow
- [ ] Implement session management (issue/PR → session mapping)
- [ ] Add MCP client integration for memory
- [ ] Create agent with GitHub context
- [ ] Implement response posting
- [ ] Add error handling and logging
- [ ] Write GitHub bot tests (40+ tests)
- [ ] Deploy GitHub App
- [ ] Document setup and usage

**Output**: Production GitHub bot ✅

---

### Phase 7: Telegram Bot Integration (3-4 days)

**Goal**: Telegram bot for chat and notifications

**Tasks**:
- [ ] Create apps/telegram-bot package
- [ ] Register Telegram bot
- [ ] Set up Telegraf framework
- [ ] Implement commands:
  - [ ] /start
  - [ ] /chat
  - [ ] /status
  - [ ] /sessions
  - [ ] /help
- [ ] Create message handler
- [ ] Add MCP client integration
- [ ] Implement session management
- [ ] Add notification system (for GitHub events)
- [ ] Write Telegram bot tests (25+ tests)
- [ ] Deploy bot
- [ ] Document usage

**Output**: Production Telegram bot ✅

---

### Phase 8: API Gateway (3-4 days)

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

### Phase 9: Integration & Testing (4-5 days)

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

### Phase 10: Documentation & Deployment (2-3 days)

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
- [ ] Set up CI/CD pipelines
  - [ ] .github/workflows/deploy-mcp.yml
  - [ ] .github/workflows/deploy-server.yml
  - [ ] .github/workflows/tests.yml
- [ ] Deploy all components to production
- [ ] Monitor and verify

**Output**: Production deployment with documentation ✅

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
- [ ] Multi-provider support works (Claude, Z.AI, OpenRouter)
- [ ] Container deployment successful

---

## Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Monorepo** | pnpm workspaces + Turborepo | Fast, efficient, great TypeScript support |
| **Agent Server** | Node.js/Bun + Docker | Long-running, stateful, containerized |
| **MCP Memory Server** | Cloudflare Workers + D1 + KV | Edge deployment, low latency, scalable |
| **CLI** | Node.js + Ink + Commander | Cross-platform, rich terminal UI |
| **GitHub Bot** | Probot/Octokit | Official GitHub App framework |
| **Telegram Bot** | Telegraf | Best TypeScript bot framework |
| **API Gateway** | Hono | Fast, lightweight, edge-compatible |
| **Testing** | Vitest | Fast, modern, great DX |
| **LLM** | Claude/OpenAI/Z.AI | Multi-provider flexibility |
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
pnpm install

# Build all packages
pnpm run build

# Test all packages
pnpm run test

# Test specific package
pnpm run test --filter @duyetbot/core

# Build specific package
pnpm run build --filter @duyetbot/memory-mcp

# Add dependency to package
cd packages/core
pnpm add zod

# Add dev dependency
pnpm add -D vitest --filter @duyetbot/core

# Run CLI locally
pnpm --filter @duyetbot/cli dev

# Deploy MCP server
pnpm --filter @duyetbot/memory-mcp deploy

# Start agent server locally
pnpm --filter @duyetbot/server dev

# Watch mode for all packages
pnpm run dev
```

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
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
4. 🔧 **Phase 3 - Refactor Core Packages** IN PROGRESS
   - [x] Providers with base URL support
   - [x] GitHub tool created
   - [ ] Write tests for providers/tools/core
   - [x] Add MCP client integration to core
5. **Next: Phase 4 - Long-Running Agent Server**

---

**This plan represents a fundamental architectural shift toward a more flexible, scalable, and maintainable system. All existing code and tests will be preserved during migration.**
