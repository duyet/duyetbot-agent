# duyetbot-agent

Personal AI agent with multi-platform routing, persistent memory, and edge deployment.

[![Tests](https://img.shields.io/badge/tests-969%2B%20passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://duyet.github.io/duyetbot-agent)

## Overview

AI assistant with intelligent routing and specialized handlers across GitHub, Telegram, and CLI. Built with Cloudflare Durable Objects and Claude Agent SDK.

**Features:**
- 🔄 **Loop-Based Agent**: Single agent with LLM reasoning loop and tool iterations
- 🔧 **Tool System**: Built-in tools (bash, git, github, research, plan) + MCP integration
- 💾 **Persistent Memory**: Cross-session context via MCP + D1/KV
- 🚀 **Edge Deployment**: Cloudflare Workers + Durable Objects
- 🔧 **Multi-LLM**: OpenRouter via AI Gateway
- 📊 **Analytics Dashboard**: Real-time monitoring and cost tracking
- 📦 **Monorepo**: Bun + TypeScript + Vitest (1019+ tests)

## Architecture

```
User → Telegram/GitHub → Transport → CloudflareChatAgent (DO)
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │  Chat Loop   │ ◄─── LLM Provider
                                      │              │
                                      │  ┌────────┐  │
                                      │  │ Tools  │  │ ◄─── Built-in + MCP
                                      │  └────────┘  │
                                      │              │
                                      │  ┌────────┐  │
                                      │  │ Track  │  │ ◄─── Token/cost
                                      │  └────────┘  │
                                      └──────────────┘
```

**Loop-Based Agent** (replaced multi-agent routing):
- Single Durable Object with chat loop
- Tool iterations until task completion
- Real-time progress updates
- Built-in tools: bash, git, github, research, plan
- MCP tools: duyet-mcp, github-mcp, custom servers

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
bun run test     # Run 969+ tests
bun run check    # Lint + typecheck

# Deploy
bun run deploy                # All bots
bun run deploy:telegram       # Telegram bot
bun run deploy:github         # GitHub bot
```

## Project Structure

```
packages/
├── cloudflare-agent # Loop-based agent (2000+ LOC, 969 tests)
├── core           # SDK adapter for agent-server
├── tools          # Built-in tools (bash, git, github)
├── providers      # LLM providers (Claude, OpenRouter)
├── prompts        # System prompts (TypeScript)
├── types          # Shared types
└── hono-middleware # Shared Hono utilities

apps/
├── telegram-bot    # Telegram interface + webhook handler
├── github-bot      # GitHub webhook + webhook handler
├── memory-mcp      # Memory persistence (D1 + KV)
├── dashboard       # Analytics dashboard (Next.js + D1)
└── agent-server    # Heavy compute (future: Claude Agent SDK)
```

## Documentation

- **[Architecture](./docs/architecture.md)** - System design + routing flow
- **[Getting Started](./docs/getting-started.md)** - Setup guide
- **[API Reference](./docs/api.md)** - API endpoints
- **[Deployment](./docs/deployment.md)** - Deploy guide
- **[PLAN.md](./PLAN.md)** - Roadmap + progress
- **[Code Browse](https://zread.ai/duyet/duyetbot-agent)** - Browse code on zread.ai
- **[Dashboard](./apps/dashboard)** - Analytics dashboard with cost tracking

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with Claude Code**
