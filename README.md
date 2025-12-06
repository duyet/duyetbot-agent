# duyetbot-agent

Personal AI agent with multi-platform routing, persistent memory, and edge deployment.

[![Tests](https://img.shields.io/badge/tests-746%2B%20passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://duyet.github.io/duyetbot-agent)

## Overview

AI assistant with intelligent routing and specialized handlers across GitHub, Telegram, and CLI. Built entirely on Cloudflare Workers and Durable Objects for serverless edge deployment.

**Features:**
- **Smart Routing**: Hybrid classifier (pattern + LLM) for query routing
- **Multi-Agent System**: 8 specialized Durable Objects for different task types
- **Persistent Memory**: Cross-session context via MCP + D1/KV
- **Edge Deployment**: Cloudflare Workers with zero cold start
- **Multi-LLM**: Claude, OpenRouter, AI Gateway support
- **Monorepo**: Bun + TypeScript + Vitest

## Architecture

```
User → Telegram/GitHub → Transport → RouterAgent
                                          │
                        ┌─────────────────┼─────────────────┐
                        ▼                 ▼                 ▼
                  SimpleAgent      OrchestratorAgent    HITLAgent
                  (quick Q&A)      (task decomp)       (approval)
                                          │
                        ┌─────────────────┼─────────────────┐
                        ▼                 ▼                 ▼
                  CodeWorker        ResearchWorker    GitHubWorker
```

**8 Durable Objects** (deployed via `shared-agents`):
RouterAgent, SimpleAgent, HITLAgent, OrchestratorAgent, CodeWorker, ResearchWorker, GitHubWorker, DuyetInfoAgent

Implements [Cloudflare Agent Patterns](https://developers.cloudflare.com/agents/patterns/): Routing, Parallelization, Orchestrator-Workers, HITL, Prompt Chaining.

## Quick Start

```bash
git clone https://github.com/duyet/duyetbot-agent.git
cd duyetbot-agent && bun install

bun run dev      # Watch mode
bun run build    # Build all
bun run test     # Run tests
bun run check    # Lint + typecheck

bun run deploy              # All bots
bun run deploy:telegram     # Telegram only
bun run deploy:github       # GitHub only
```

## Project Structure

```
packages/
├── cloudflare-agent  # Multi-agent routing system (2400+ LOC)
├── core              # SDK adapter, session management
├── tools             # Built-in tools (bash, git, github)
├── providers         # LLM providers (Claude, OpenRouter)
├── prompts           # System prompts
├── types             # Shared TypeScript types
└── hono-middleware   # Shared Hono utilities

apps/
├── telegram-bot      # Telegram interface + TelegramAgent DO
├── github-bot        # GitHub webhook + GitHubAgent DO
├── shared-agents     # 8 shared Durable Objects
├── memory-mcp        # Memory persistence (D1 + KV)
├── safety-kernel     # Health checks and rollback
└── docs              # Documentation site
```

## Documentation

- **[Architecture](./docs/architecture.md)** - System design and routing flow
- **[Getting Started](./docs/getting-started.md)** - Setup guide
- **[Deployment](./docs/guides/deployment.md)** - Deploy guide
- **[API Reference](./docs/reference/api.md)** - API endpoints
- **[PLAN.md](./PLAN.md)** - Roadmap

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with Claude Code**
