# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**duyetbot-agent** is a **fully autonomous AI agent system** built as a monorepo. It implements a **Hybrid Supervisor-Worker Architecture** with Cloudflare Workers for edge deployment and Durable Objects for stateful agent persistence.

**Vision**: Build a fully autonomous agent system that can plan, implement, and deploy solutions across multiple interfaces and platforms - from GitHub workflows to Telegram chat, from web dashboards to CLI tools.

**Stack**: Bun + TypeScript + Hono + Cloudflare Workers + Vitest

## Vision & Principles

### Core Vision Statement

The goal of **duyetbot-agent** is to create a **fully autonomous AI agent system** that:

1. **Plans autonomously** - Breaks down complex tasks into actionable steps without human intervention
2. **Implements independently** - Writes, tests, and deploys code across the full stack
3. **Operates across multiple interfaces** - Seamlessly works through:
   - **GitHub**: @mentions, PR reviews, issue management, Actions workflows
   - **Telegram**: Chat interface for queries and notifications
   - **Web**: Dashboard for monitoring and management
   - **CLI**: Local development tools and commands
   - **MCP**: Extensible tool integration

### Autonomous Capabilities

- **Multi-Agent Routing**: 8 specialized agents (Router, Simple, Orchestrator, HITL, CodeWorker, ResearchWorker, GitHubWorker, DuyetInfo)
- **Task Decomposition**: OrchestratorAgent breaks complex tasks into parallel workstreams
- **Human-in-the-Loop**: HITLAgent for sensitive operations requiring approval
- **Persistent Memory**: Cross-session context via MCP + D1/KV storage
- **Edge Deployment**: Cloudflare Workers + Durable Objects for global scalability

### Architecture Principles

| Principle | Implementation |
|-----------|----------------|
| **Fire-and-Forget** | Webhooks return immediately, DOs process independently |
| **Dual-Batch Queue** | pendingBatch (collecting) + activeBatch (processing) for reliability |
| **Transport Abstraction** | Platform-agnostic agent logic, pluggable platform transports |
| **Hybrid Classification** | Pattern match (fast) + LLM fallback (semantic) |
| **Heartbeat Recovery** | Rotating messages prove liveness, auto-recover from stuck batches |

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
| `apps/shared-agents` | Workers + DO | 8 shared Durable Objects (Router, Orchestrator, Workers) |
| `apps/memory-mcp` | Workers + D1 | Cross-session memory (MCP server) |
| `apps/duyetbot-action` | Workers | GitHub Actions integration for autonomous workflows |
| `apps/safety-kernel` | Workers | Safety layer for agent operations |
| `apps/dashboard` | Cloudflare Pages | Web dashboard for monitoring and management |
| `apps/web` | Cloudflare Pages | Web interface |
| `apps/docs` | Cloudflare Pages | Documentation site |

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

### Cloudflare Secrets

```bash
bun run config
bun run config:telegram
bun run config:github
```

## Testing

```bash
bun run test                              # All tests
bun run test --filter @duyetbot/core      # Specific package
bun run test --filter @duyetbot/chat-agent # Routing tests (226)
```

## Documentation

See docs/ folder.

## External References

- [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sdk)
- [Cloudflare Agents Patterns](https://developers.cloudflare.com/agents/patterns/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

# Note

In PLAN mode, always plan and break down tasks for asking multiple agents (e.g., a senior agent for simple tasks or an agent leader for complex ones) to work in parallel and maximize efficiency as needed.

Prefer to use Linux bash commands instead instead of read the file content directly to the context (for lint verify format, lint, ...) refer using grep/find/awk/sed/etc ... if possible.
