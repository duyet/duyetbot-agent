# Architecture

**Related:** [Getting Started](README.md) | [Deployment](DEPLOY.md)

## Overview

duyetbot-agent is a personal AI agent system with a containerized architecture: long-running agent server + Cloudflare MCP memory layer + monorepo structure.

## High-Level System Design

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

## Key Architectural Decisions

| Component | Design Choice | Rationale |
|-----------|--------------|-----------|
| **Main Runtime** | Node.js/Bun Container | Long-running stateful sessions, no CPU limits |
| **Memory Layer** | MCP Server (CF Workers) | Standardized protocol, reusable across clients |
| **Project Structure** | Monorepo (pnpm) | Separated concerns, independent deployments |
| **Provider System** | Base URL override support | Flexible (Z.AI, custom endpoints) |

## Components

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

### Core (`packages/core`)

Agent orchestration and session management:
- Multi-turn conversation handling
- Tool execution engine
- MCP client integration

### Providers (`packages/providers`)

LLM provider adapters with base URL override:
- **Claude** - Anthropic API (supports Z.AI via base URL)
- **OpenAI** - GPT models
- **OpenRouter** - Multi-provider gateway

Format: `<provider>:<model_id>` (e.g., `claude:claude-3-5-sonnet-20241022`)

### Tools (`packages/tools`)

Built-in tool implementations:
- `bash` - Shell command execution
- `git` - Repository operations
- `github` - API operations (14 actions)
- `research` - Web research
- `plan` - Task planning
- `sleep` - Execution delay

### Memory MCP (`packages/memory-mcp`)

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

### Server (`packages/server`)

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
6. Core agent processes task with tools
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

| Component | Technology |
|-----------|-----------|
| **Monorepo** | pnpm workspaces + Turborepo |
| **Agent Server** | Node.js/Bun + Docker |
| **MCP Memory** | Cloudflare Workers + D1 + KV |
| **CLI** | Node.js + Ink + Commander |
| **GitHub Bot** | Hono + Octokit |
| **API Gateway** | Hono |
| **Testing** | Vitest |
| **LLM** | Claude/OpenAI/Z.AI |

## Deployment

See [Deployment Guide](DEPLOY.md) for detailed instructions on:
- [Railway](DEPLOY.md#deploy-to-railway)
- [Fly.io](DEPLOY.md#deploy-to-flyio)
- [Render](DEPLOY.md#deploy-to-render)
- [AWS ECS/Fargate](DEPLOY.md#deploy-to-aws-ecsfargate)
- [Docker Compose](DEPLOY.md#deploy-with-docker-compose)

## Next Steps

- [Getting Started](README.md) - Installation and quick start
- [Report Issues](https://github.com/duyet/duyetbot-agent/issues)
