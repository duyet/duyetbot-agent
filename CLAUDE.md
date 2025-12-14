# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**duyetbot-agent** is a personal AI agent system built as a monorepo. It implements a **loop-based agent architecture** with Cloudflare Workers for edge deployment and Durable Objects for stateful agent persistence.

**Stack**: Bun + TypeScript + Hono + Cloudflare Workers + Vitest

## Quick Reference

```bash
# Development
bun install              # Setup
bun run dev              # Dev mode
bun run build            # Build all
bun run check            # Lint + type-check
bun run test             # All tests

# Local Deployment (includes dependencies)
bun run deploy           # Deploy all bots
bun run deploy:telegram  # Telegram + dependencies
bun run deploy:github    # GitHub + dependencies

# CI Deployment (single app, for Cloudflare Dashboard)
bun run ci:deploy:telegram       # Deploy telegram only
bun run ci:deploy:github         # Deploy github only
bun run ci:deploy-version:*      # Branch deploy

# Prompt Evaluation (requires OPENROUTER_API_KEY)
bun run prompt:eval              # Run all prompt evaluations
bun run prompt:eval:router       # Router classification tests
bun run prompt:eval:telegram     # Telegram format tests
bun run prompt:view              # Interactive results UI
```

## Architecture

> **Full details**: See [docs/architecture.md](docs/architecture.md)

### Loop-Based Agent Architecture

Each bot deploys a single Durable Object using `createCloudflareChatAgent()` with an LLM chat loop and tool iterations:

```
User Message → CloudflareChatAgent
                      │
                      ▼
              ┌──────────────┐
              │   Chat Loop  │ ◄─── LLM Provider (OpenRouter)
              │              │
              │  ┌────────┐  │
              │  │ Tools  │  │ ◄─── Built-in + MCP tools
              │  └────────┘  │
              │              │
              │  ┌────────┐  │
              │  │ Track  │  │ ◄─── Token/step tracking → D1
              │  └────────┘  │
              └──────────────┘
                      │
                      ▼
              Transport Layer → Platform (Telegram/GitHub)
```

**Key Modules** (in `@duyetbot/cloudflare-agent`):
- `chat/` - Chat loop, tool executor, context builder, response handler
- `tracking/` - Token tracker, execution logger
- `persistence/` - Message store, session manager
- `workflow/` - Step tracker, debug footer

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
| `@duyetbot/cloudflare-agent` | Cloudflare agent with chat loop | `createCloudflareChatAgent`, `ChatLoop`, `TokenTracker` |
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


Commit Co-Author:

```
Co-Authored-By: duyetbot <duyetbot@users.noreply.github.com>
```

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

**969+ tests** across all packages:

```bash
bun run test                                 # All tests
bun run test --filter @duyetbot/core         # Specific package
bun run test --filter @duyetbot/cloudflare-agent # Agent tests (969)
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/cloudflare-agent/src/cloudflare-agent.ts` | Main Cloudflare agent factory |
| `packages/cloudflare-agent/src/chat/chat-loop.ts` | LLM chat loop with tool iterations |
| `packages/cloudflare-agent/src/chat/tool-executor.ts` | Unified tool execution (builtin + MCP) |
| `packages/cloudflare-agent/src/tracking/token-tracker.ts` | Token usage and cost tracking |
| `packages/cloudflare-agent/src/persistence/message-store.ts` | Message persistence facade |
| `packages/core/src/sdk/query.ts` | SDK query execution |
| `apps/*/src/transport.ts` | Platform-specific transports |

## Documentation

| Document | Content |
|----------|---------|
| [docs/architecture.md](docs/architecture.md) | System design, routing flow, patterns |
| [docs/deployment.md](docs/deployment.md) | Deployment commands and secrets |
| [docs/getting-started.md](docs/getting-started.md) | Setup guide |
| [docs/api.md](docs/api.md) | API reference |
| [docs/guides/prompt-evaluation.md](docs/guides/prompt-evaluation.md) | Prompt testing with promptfoo |
| [prompts-eval/README.md](prompts-eval/README.md) | Prompt evaluation technical details |
| [PLAN.md](PLAN.md) | Implementation roadmap |

## External References

- [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sdk)
- [Cloudflare Agents Patterns](https://developers.cloudflare.com/agents/patterns/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Important notes

- Whenever there is a lint error or a type check error, launch a senior engineer to fix it in the background.
- When to run `bun run test`, `bun run deploy`, or `git push`: do it in the junior engineer sub-agent (to save token usage).
- test, deploy, and `git push` can run in parallel. Launch multiple junior engineers to do this at the same time.
- When running tests and deploying in parallel using junior engineers, these agents should only report a summary of their tasks, not the full details. For example, deploy and test steps produce a lot of logs, which can overload the main thread context.
- Junior engineers, when running deploys, should use the bun script running at the root. For example: `bun run deploy:telegram`, `bun run deploy:github`, ... `bun run deploy` to deploy all.
