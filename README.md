# duyetbot-agent

**Fully autonomous AI agent system** with multi-platform routing, persistent memory, and edge deployment.

[![Tests](https://img.shields.io/badge/tests-1231%2B%20passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://duyet.github.io/duyetbot-agent)

## Overview

**duyetbot-agent** is a **fully autonomous AI agent system** that can plan, implement, and deploy solutions across multiple interfaces and platforms. Built with Cloudflare Durable Objects and Claude Agent SDK, it features intelligent multi-agent routing, task decomposition, and cross-platform operations.

### Vision

Build a fully autonomous agent system that:

1. **Plans autonomously** - Breaks down complex tasks into actionable steps
2. **Implements independently** - Writes, tests, and deploys code across the full stack
3. **Operates across multiple interfaces**:
   - 📱 **Telegram** - Chat interface for queries and notifications
   - 💻 **GitHub** - @mentions, PR reviews, Issues, Actions workflows
   - 🌐 **Web** - Dashboard for monitoring and management
   - ⌨️ **CLI** - Local development tools
   - 🔌 **MCP** - Extensible tool integration

**Features:**
- 🎯 **Smart Routing**: Hybrid classifier (pattern + LLM) for query routing
- 🔄 **Multi-Agent System**: 8 specialized agents (Router, Simple, HITL, Orchestrator, 3 Workers, DuyetInfo)
- 🧩 **Task Decomposition**: Orchestrator breaks complex tasks into parallel workstreams
- 👥 **Human-in-the-Loop**: HITL agent for sensitive operations requiring approval
- 💾 **Persistent Memory**: Cross-session context via MCP + D1/KV
- 🚀 **Edge Deployment**: Cloudflare Workers + Durable Objects
- 🔧 **Multi-LLM**: Claude, OpenRouter, AI Gateway support
- 📦 **Monorepo**: Bun + TypeScript + Vitest (746+ tests)

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
1. **RouterAgent**: Hybrid classifier (pattern + LLM)
2. **SimpleAgent**: Direct responses
3. **HITLAgent**: Human-in-the-loop approvals
4. **OrchestratorAgent**: Task decomposition + parallel execution
5. **CodeWorker**: Code review/analysis
6. **ResearchWorker**: Web search
7. **GitHubWorker**: PR/issue operations
8. **DuyetInfoAgent**: Personal blog queries

**Cloudflare Patterns**: ✅ Routing ✅ Parallelization ✅ Orchestrator-Workers ✅ HITL ✅ Prompt Chaining

See [docs/architecture.md](./docs/architecture.md) for details.

## Quick Start

```bash
# Install
git clone https://github.com/duyet/duyetbot-agent.git
cd duyetbot-agent
bun install

# Develop
bun run dev      # Watch mode for all packages
bun run build    # Build all
bun run test     # Run 1231+ tests
bun run check    # Lint + typecheck

# Deploy
bun run deploy                # All bots
bun run deploy:telegram       # Telegram only
bun run deploy:github         # GitHub only
bun run deploy:shared-agents  # Shared DOs
```

## Project Structure

```
packages/
├── chat-agent     # Multi-agent routing system (2400+ LOC, 277 tests)
├── core           # SDK adapter for agent-server
├── tools          # Built-in tools (bash, git, github)
├── providers      # LLM providers (Claude, OpenRouter)
├── prompts        # System prompts (TypeScript)
├── types          # Shared types
└── hono-middleware # Shared Hono utilities

apps/
├── telegram-bot    # Telegram interface + TelegramAgent DO
├── github-bot      # GitHub webhook + GitHubAgent DO
├── shared-agents   # 8 shared DOs (Router, Simple, HITL, etc.)
├── memory-mcp      # Memory persistence (D1 + KV)
├── duyetbot-action # GitHub Actions integration
├── safety-kernel   # Safety layer for agent operations
├── dashboard       # Web dashboard (Cloudflare Pages)
├── web             # Web interface (Cloudflare Pages)
└── docs            # Documentation site (Cloudflare Pages)
```

## Documentation

- **[Architecture](./docs/architecture.md)** - System design + routing flow
- **[Getting Started](./docs/getting-started.md)** - Setup guide
- **[API Reference](./docs/reference/api.md)** - API endpoints
- **[Deployment](./docs/guides/deployment.md)** - Deploy guide
- **[PLAN.md](./PLAN.md)** - Roadmap + progress

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with Claude Code**
