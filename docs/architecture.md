# Architecture

**Related:** [Getting Started](getting-started.md) | [Use Cases](usecases.md) | [API Reference](api.md) | [Deployment](deploy.md)

## Overview

duyetbot-agent is a personal AI agent system built on the **Claude Agent SDK as its core engine**. It features a containerized architecture with long-running agent server + Cloudflare MCP memory layer + monorepo structure.

## High-Level System Design

```
┌──────────────────────────────────────────────────────────────────┐
│                        User Interactions                          │
├────────────────┬────────────────┬──────────────┬─────────────────┤
│ GitHub @mentions│ Telegram Bot   │  CLI Tool    │ Web UI (future) │
└────────┬───────┴────────┬───────┴──────┬───────┴─────────────────┘
         │                │              │
         │                │              │
    ┌────▼────────────────▼──────────────│─────┐
    │       HTTP API Gateway (Hono)      │     │
    │   - Authentication                 │     │
    │   - Rate limiting                  │     │
    │   - Request routing                │     │
    └────────────────────┬───────────────│─────┘
                         │               │
         ┌───────────────┼───────────┐   │
         │               │           │   │
    ┌────▼────┐     ┌────▼────┐      │   │
    │ GitHub  │     │Telegram │      │   │
    │  Bot    │     │  Bot    │      │   │
    │ Handler │     │ Handler │      │   │
    └────┬────┘     └────┬────┘      │   │
         │               │           │   │
         └───────────────┼───────────┘   │
                         │               │
                         │      ┌────────▼────────┐
                         │      │   CLI Tool      │
                         │      │ (SDK embedded)  │
                         │      └────────┬────────┘
                         │               │
              ┌──────────▼───────────────▼─┐
              │   Claude Agent SDK         │  ← Core Engine
              │   (packages/core/sdk)      │
              ├────────────────────────────┤
              │ • query() execution        │
              │ • tool() definitions       │
              │ • Subagent system          │
              │ • MCP connections          │
              └──────────┬─────────────────┘
                         │
              ┌──────────▼──────────┐
              │  MCP Memory Server   │
              │ (Cloudflare Workers) │
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
    │(Metadata)│   │(Messages)│      │ (Search)│
    └─────────┘    └─────────┘      └─────────┘
```

## Claude Agent SDK as Core Engine

The Claude Agent SDK is the **primary execution engine** for all agent operations:

```typescript
// SDK query with streaming
import { query, createDefaultOptions } from '@duyetbot/core';

// Execute with tools and streaming
const options = createDefaultOptions({
  model: 'sonnet',
  tools: [bashTool, gitTool],
  systemPrompt: 'You are a helpful assistant.',
});

for await (const message of query('Help me review this PR', options)) {
  switch (message.type) {
    case 'assistant':
      console.log(message.content);  // Stream response
      break;
    case 'tool_use':
      console.log(`Using: ${message.toolName}`);
      break;
    case 'result':
      console.log(`Tokens: ${message.totalTokens}, Time: ${message.duration}ms`);
      break;
  }
}
```

### Benefits

1. **Reduced Complexity** - No custom agent loop
2. **Feature Parity** - Get all SDK features automatically
3. **Maintenance** - SDK updates improve duyetbot
4. **Reliability** - Battle-tested execution engine

### SDK Integration Layer (`packages/core/src/sdk/`)

- `query.ts` - Query execution with Anthropic API integration
- `tool.ts` - Tool definitions with Zod schemas
- `options.ts` - Configuration (model, permissions, MCP, subagents)
- `subagent.ts` - Predefined subagents (researcher, codeReviewer, etc.)
- `types.ts` - SDK message types

### SDK Execution Flow

```
User Input → query()
     │
     ▼
┌─────────────────┐
│ Validate Options│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Messages  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Call Anthropic  │────►│  Retry Logic    │
│      API        │◄────│ (exp backoff)   │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Parse Response  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
[Text]    [Tool Use]
    │         │
    │         ▼
    │    ┌─────────────┐
    │    │Execute Tools│
    │    │ (validate,  │
    │    │  run, yield)│
    │    └──────┬──────┘
    │          │
    │    ┌─────▼──────┐
    │    │Tool Results│
    │    └─────┬──────┘
    │          │
    └────┬─────┘
         │ (loop until end_turn)
         ▼
┌─────────────────┐
│  Result Message │
│ (tokens, time)  │
└─────────────────┘
```

### Error Handling & Retry Strategy

The SDK implements automatic retry with exponential backoff:

```typescript
// Retryable errors (automatic retry up to 3 times)
- 429: Rate limit exceeded
- 500: Server error
- 502: Bad gateway
- 503: Service unavailable
- 504: Gateway timeout
- Network errors (timeout, connection refused)

// Backoff: 1s → 2s → 4s (with ±20% jitter)
```

### Environment Configuration

```env
# Required for LLM
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional: Alternative endpoint (Z.AI, proxy)
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Model shortcuts
# haiku  → claude-3-5-haiku-20241022
# sonnet → claude-sonnet-4-20250514
# opus   → claude-3-opus-20240229
```

## Key Architectural Decisions

| Component | Design Choice | Rationale |
|-----------|--------------|-----------|
| **Core Engine** | Claude Agent SDK | Battle-tested, feature-rich, maintained by Anthropic |
| **Main Runtime** | Node.js/Bun Container | Long-running stateful sessions, no CPU limits |
| **Memory Layer** | MCP Server (CF Workers) | Standardized protocol, reusable across clients |
| **Project Structure** | Monorepo (pnpm) | Separated concerns, independent deployments |
| **Provider System** | Base URL override support | Flexible (Z.AI, custom endpoints) |
| **LLM Providers** | Claude-compatible only | Focused support (Claude, Z.AI, OpenRouter) |

## Components

### Core (`packages/core`)

Agent orchestration with SDK integration:
- **SDK adapter layer** (`sdk/`) - Thin wrapper around Claude Agent SDK
- **Session management** - Conversation state tracking
- **MCP client** - Memory server integration

Key SDK patterns:
```typescript
// Query execution
for await (const message of query(input, options)) {
  // Stream responses
}

// Tool definition
const tool = sdkTool('name', 'description', zodSchema, handler);

// Subagent delegation
const options = { agents: [{ name: 'researcher', ... }] };
```

### GitHub Bot (`apps/github-bot`)

Handles GitHub webhook events:
- **Issue comments**: Responds to @duyetbot mentions
- **PR comments**: Code review assistance
- **Issues/PRs**: Auto-respond on open/label

Key files:
- `index.ts` - Hono HTTP server and webhook routing
- `webhooks/` - Event handlers (issues.ts, pull-request.ts)
- `session-manager.ts` - Conversation persistence with MCP
- `mention-parser.ts` - Extract tasks from mentions
- `agent-handler.ts` - System prompt builder and response generation

### Providers (`packages/providers`)

LLM provider adapters with base URL override:
- **Claude** - Anthropic API (supports Z.AI via base URL)
- **OpenRouter** - Multi-provider gateway

Format: `<provider>:<model_id>` (e.g., `claude:claude-3-5-sonnet-20241022`)

### Tools (`packages/tools`)

Built-in tool implementations (SDK-compatible):
- `bash` - Shell command execution
- `git` - Repository operations
- `github` - API operations (14 actions)
- `research` - Web research
- `plan` - Task planning
- `sleep` - Execution delay

### Memory MCP (`apps/memory-mcp`)

MCP-compatible memory server on Cloudflare Workers:
- **D1** - Session metadata, users, tokens
- **KV** - Message history (JSONL format)
- **Vectorize** - Semantic search (future)

MCP Tools:
- `authenticate` - GitHub token verification
- `get_memory` - Load session messages
- `save_memory` - Persist messages
- `search_memory` - Text/semantic search
- `list_sessions` - List user sessions

### Agent Server (`apps/agent-server`)

Long-running agent server:
- WebSocket support for streaming
- Session lifecycle management
- Health check endpoints
- Graceful shutdown

### CLI (`packages/cli`)

Command-line interface:
- Local mode (file storage)
- Cloud mode (MCP memory)
- GitHub OAuth device flow
- Ink-based terminal UI

## Data Flow

### GitHub Mention → Response

1. GitHub sends webhook to `/webhook`
2. Webhook handler validates signature
3. Mention parser extracts task from comment
4. Session manager loads/creates session from MCP
5. Agent handler builds system prompt with context
6. **Claude Agent SDK** processes task with tools
7. Response posted as GitHub comment
8. Session saved to MCP memory

### Session Management

Sessions are identified by deterministic IDs:
```
github:{owner}/{repo}:{type}:{number}
```

Example: `github:duyet/duyetbot-agent:issue:42`

## Configuration

### Environment Variables

```env
# Required
BOT_USERNAME=duyetbot
GITHUB_TOKEN=ghp_xxx
WEBHOOK_SECRET=xxx

# LLM Provider
ANTHROPIC_API_KEY=xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com  # or Z.AI URL

# Optional MCP Memory
MCP_SERVER_URL=https://memory.duyetbot.workers.dev
MCP_AUTH_TOKEN=xxx
```

### GitHub App Permissions

- **Issues**: Read & Write
- **Pull requests**: Read & Write
- **Contents**: Read
- **Actions**: Read & Write

### Webhook Events

- `issue_comment`
- `pull_request_review_comment`
- `issues`
- `pull_request`

## Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Agent Engine** | Claude Agent SDK | Core execution engine |
| **Monorepo** | pnpm workspaces + Turborepo | Build orchestration |
| **Agent Server** | Node.js/Bun + Docker | Long-running container |
| **MCP Memory** | Cloudflare Workers + D1 + KV | Edge-based persistence |
| **CLI** | Node.js + Ink + Commander | Terminal UI |
| **GitHub Bot** | Hono + Octokit | Webhook handling |
| **API Gateway** | Hono | Fast, edge-compatible |
| **Testing** | Vitest | 443+ tests |
| **LLM** | Claude/Z.AI/OpenRouter | Claude-compatible APIs |

## Test Coverage

- **443 tests** across all packages
- Core: 101 tests (44 SDK tests)
- Providers: 38 tests
- Tools: 51 tests
- Memory-MCP: 93 tests
- CLI: 67 tests
- GitHub-Bot: 57 tests
- Server: 36 tests

## Deployment

See [Deployment Guide](deploy.md) for detailed instructions on:
- [Railway](deploy.md#deploy-to-railway)
- [Fly.io](deploy.md#deploy-to-flyio)
- [Render](deploy.md#deploy-to-render)
- [AWS ECS/Fargate](deploy.md#deploy-to-aws-ecsfargate)
- [Docker Compose](deploy.md#deploy-with-docker-compose)

## Next Steps

- [Getting Started](getting-started.md) - Installation and quick start
- [Report Issues](https://github.com/duyet/duyetbot-agent/issues)
