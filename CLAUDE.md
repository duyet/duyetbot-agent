# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**duyetbot-agent** is a personal AI agent system built as a monorepo. It implements a **Hybrid Supervisor-Worker Architecture** with Cloudflare Workers for edge deployment and Durable Objects for stateful agent persistence.

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
bun run deploy           # Deploy all bots
bun run deploy:telegram  # Telegram only
bun run deploy:github    # GitHub only
```

## Architecture

> **Full details**: See [docs/architecture.md](docs/architecture.md)

### Two-Tier Agent System

```
Tier 1 (Cloudflare Workers)          Tier 2 (Container/Fly.io)
├── telegram-bot (DO)                └── agent-server
├── github-bot (DO)                      ├── Claude Agent SDK
└── memory-mcp (D1+KV)                   ├── Filesystem access
    Fast, serverless, stateful           └── Shell tools (git, bash)
```

### Multi-Agent Routing (Tier 1)

Each bot deploys Durable Objects implementing [Cloudflare Agent Patterns](https://developers.cloudflare.com/agents/patterns/):

```
User Message → CloudflareChatAgent → RouterAgent (classifier)
                                          │
              ┌───────────────────────────┼──────────────────────┐
              ↓                           ↓                      ↓
        SimpleAgent              OrchestratorAgent         DuyetInfoAgent
        (quick Q&A)              (task decomposition)      (personal info)
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ↓                     ↓                     ↓
              CodeWorker          ResearchWorker          GitHubWorker
```

**Note**: Router dispatches to **Agents** only. Workers are dispatched by OrchestratorAgent.

### Transport Layer Pattern

Platform-agnostic messaging abstraction (~50 lines per app):

```typescript
interface Transport<TContext> {
  send: (ctx: TContext, text: string) => Promise<MessageRef>;
  edit?: (ctx: TContext, ref: MessageRef, text: string) => Promise<void>;
  parseContext: (ctx: TContext) => ParsedInput;
}
```

## Packages

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@duyetbot/core` | SDK adapter, session, MCP client | `query()`, `sdkTool()` |
| `@duyetbot/chat-agent` | Cloudflare agent patterns | `CloudflareChatAgent`, routing, HITL |
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
| `apps/memory-mcp` | Workers + D1 | Cross-session memory (MCP server) |
| `apps/agent-server` | Container | Long-running agent with filesystem |

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

### PLAN.md Maintenance

- Read PLAN.md before starting work
- Check off completed tasks with `[x]`
- Commit PLAN.md with code changes

## Configuration

### Environment Variables

```bash
# Platform Tokens
TELEGRAM_BOT_TOKEN=xxx
GITHUB_TOKEN=ghp_xxx
GITHUB_WEBHOOK_SECRET=xxx

# Optional
ROUTER_DEBUG=false  # Enable routing logs
```

### Cloudflare Secrets

```bash
bun run config
bun run config:telegram
bun run config:github
```

> **Deployment details**: See [docs/deployment.md](docs/deployment.md)

## Testing

**746+ tests** across all packages:

```bash
bun run test                              # All tests
bun run test --filter @duyetbot/core      # Specific package
bun run test --filter @duyetbot/chat-agent # Routing tests (226)
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/chat-agent/src/cloudflare-agent.ts` | Main Cloudflare agent (2400+ LOC) |
| `packages/chat-agent/src/agents/router-agent.ts` | Query classification & routing |
| `packages/chat-agent/src/routing/classifier.ts` | Hybrid classifier (pattern + LLM) |
| `packages/core/src/sdk/query.ts` | SDK query execution |
| `apps/*/src/transport.ts` | Platform-specific transports |

## Documentation

| Document | Content |
|----------|---------|
| [docs/architecture.md](docs/architecture.md) | System design, routing flow, patterns |
| [docs/deployment.md](docs/deployment.md) | Deployment commands and secrets |
| [docs/getting-started.md](docs/getting-started.md) | Setup guide |
| [docs/api.md](docs/api.md) | API reference |
| [PLAN.md](PLAN.md) | Implementation roadmap |

## External References

- [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sdk)
- [Cloudflare Agents Patterns](https://developers.cloudflare.com/agents/patterns/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
