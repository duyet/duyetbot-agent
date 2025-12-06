# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**duyetbot-agent** is a personal AI agent system built as a monorepo. It implements multi-agent routing with Cloudflare Workers for edge deployment and Durable Objects for stateful agent persistence.

**Stack**: Bun + TypeScript + Hono + Cloudflare Workers + Vitest

## Quick Reference

```bash
# Development
bun install              # Setup
bun run dev              # Dev mode
bun run build            # Build all
bun run check            # Lint + type-check
bun run test             # All tests

# Deployment
bun run deploy           # Deploy all
bun run deploy:telegram  # Telegram only
bun run deploy:github    # GitHub only
```

## Architecture

Each bot deploys Durable Objects implementing [Cloudflare Agent Patterns](https://developers.cloudflare.com/agents/patterns/):

```
User Message → Transport → RouterAgent (classifier)
                                │
              ┌─────────────────┼──────────────────────┐
              ↓                 ↓                      ↓
        SimpleAgent      OrchestratorAgent       HITLAgent
        (quick Q&A)      (task decomposition)    (approval)
                                │
                  ┌─────────────┼─────────────────┐
                  ↓             ↓                 ↓
            CodeWorker   ResearchWorker     GitHubWorker
```

**Note**: Router dispatches to Agents only. Workers are dispatched by OrchestratorAgent.

## Packages

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@duyetbot/cloudflare-agent` | Cloudflare agent patterns | `CloudflareChatAgent`, routing, HITL |
| `@duyetbot/core` | SDK adapter, session, MCP client | `query()`, `sdkTool()` |
| `@duyetbot/tools` | Built-in tools | `bash`, `git`, `github`, `research`, `plan` |
| `@duyetbot/providers` | LLM providers | Claude, OpenRouter, AI Gateway |
| `@duyetbot/prompts` | System prompts | `getTelegramPrompt()`, `getGitHubBotPrompt()` |
| `@duyetbot/hono-middleware` | Shared Hono utilities | `createBaseApp()`, health routes |
| `@duyetbot/types` | Shared types | `Tool`, `Message`, `Agent` |

## Applications

| App | Runtime | Purpose |
|-----|---------|---------|
| `apps/telegram-bot` | Workers + DO | Telegram chat interface |
| `apps/github-bot` | Workers + DO | GitHub @mentions and webhooks |
| `apps/shared-agents` | Workers + DO | 8 shared Durable Objects |
| `apps/memory-mcp` | Workers + D1 | Cross-session memory (MCP server) |
| `apps/safety-kernel` | Workers | Health checks and rollback |

## Development Workflow

### Pre-Commit (Required)

```bash
bun run check  # lint + type-check
bun run test   # all tests pass
```

Pre-push hook enforces this automatically.

### Commit Messages

Format: `<type>: <description in lowercase>`

```bash
git commit -m "feat: add streaming support"
git commit -m "fix: resolve session error"
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

## Configuration

### Environment Variables

```bash
TELEGRAM_BOT_TOKEN=xxx
GITHUB_TOKEN=ghp_xxx
GITHUB_WEBHOOK_SECRET=xxx
ROUTER_DEBUG=false  # Enable routing logs
```

### Cloudflare Secrets

```bash
bun run config
bun run config:telegram
bun run config:github
```

## Testing

```bash
bun run test                                      # All tests
bun run test --filter @duyetbot/core              # Specific package
bun run test --filter @duyetbot/cloudflare-agent  # Routing tests
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/cloudflare-agent/src/cloudflare-agent.ts` | Main Cloudflare agent |
| `packages/cloudflare-agent/src/agents/router-agent.ts` | Query classification |
| `packages/cloudflare-agent/src/routing/classifier.ts` | Hybrid classifier |
| `packages/core/src/sdk/query.ts` | SDK query execution |
| `apps/*/src/transport.ts` | Platform-specific transports |

## Documentation

| Document | Content |
|----------|---------|
| [docs/architecture.md](docs/architecture.md) | System design, routing flow |
| [docs/guides/deployment.md](docs/guides/deployment.md) | Deployment commands |
| [docs/getting-started.md](docs/getting-started.md) | Setup guide |
| [docs/reference/api.md](docs/reference/api.md) | API reference |
| [PLAN.md](PLAN.md) | Roadmap |

## External References

- [Cloudflare Agent Patterns](https://developers.cloudflare.com/agents/patterns/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
