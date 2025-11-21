# Architecture

## Overview

duyetbot-agent is built on a modular architecture with the following key components:

```
┌─────────────────────────────────────────────────┐
│                   GitHub Bot                     │
│  (Webhook Handler, Mention Parser, Responses)   │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│                    Core Agent                    │
│     (Session Management, Tool Execution)         │
└───────────────────────┬─────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼───────┐ ┌─────▼─────┐ ┌───────▼───────┐
│   Providers   │ │   Tools   │ │    Memory     │
│ (Claude, GPT) │ │(bash, git)│ │  (MCP Server) │
└───────────────┘ └───────────┘ └───────────────┘
```

## Components

### GitHub Bot (`apps/github-bot`)

Handles GitHub webhook events:
- **Issue comments**: Responds to @mentions
- **PR comments**: Code review assistance
- **Issues/PRs**: Auto-respond on open/label

Key files:
- `index.ts` - HTTP server and webhook routing
- `webhooks/` - Event handlers (issues, pull-request)
- `session-manager.ts` - Conversation persistence
- `mention-parser.ts` - Extract tasks from mentions

### Core (`packages/core`)

Agent orchestration and session management:
- Multi-turn conversation handling
- Tool execution engine
- MCP client integration

### Providers (`packages/providers`)

LLM provider adapters:
- **Claude** - Anthropic API
- **OpenAI** - GPT models
- **OpenRouter** - Multi-provider gateway

Format: `<provider>:<model_id>` (e.g., `claude:claude-3-5-sonnet-20241022`)

### Tools (`packages/tools`)

Built-in tool implementations:
- `bash` - Shell command execution
- `git` - Repository operations
- `github` - API operations (issues, PRs, workflows)
- `research` - Web research
- `plan` - Task planning
- `sleep` - Execution delay

### Memory MCP (`packages/memory-mcp`)

MCP-compatible memory server:
- Session storage (KV/D1)
- Message history
- Metadata persistence

## Data Flow

### GitHub Mention → Response

1. GitHub sends webhook to `/webhook`
2. Webhook handler validates signature
3. Mention parser extracts task from comment
4. Session manager loads/creates session
5. Core agent processes task with tools
6. Response posted as comment

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

# Optional MCP Memory
MCP_SERVER_URL=https://memory.example.com
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

## Deployment

See [Deployment Guide](DEPLOY.md) for:
- Railway
- Fly.io
- Render
- AWS ECS/Fargate
- Docker Compose
