# duyetbot-agent

Autonomous AI agent system with persistent memory and multi-interface access.

[![Tests](https://img.shields.io/badge/tests-746%20passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://duyet.github.io/duyetbot-agent)

## Overview

Personal AI assistant that maintains context across CLI, GitHub, and Telegram. Built on Claude Agent SDK with Cloudflare edge deployment.

**Key Features:**
- Persistent memory across all interfaces
- Multi-LLM support (Claude, OpenAI, OpenRouter)
- GitHub bot for PR reviews and issue management
- CLI tool for local development
- Edge deployment on Cloudflare Workers

## Architecture

The system implements all five [Cloudflare Agent Patterns](https://developers.cloudflare.com/agents/patterns/):

| Pattern | Implementation | Status |
|---------|---------------|--------|
| Prompt Chaining | `CloudflareChatAgent.chat()` | ✅ Deployed |
| Routing | `RouterAgent` + `classifier.ts` | ✅ Deployed |
| Parallelization | `executor.ts` parallel steps | ✅ Deployed |
| Orchestrator-Workers | `OrchestratorAgent` + Workers | ✅ Deployed |
| Evaluator-Optimizer | `aggregator.ts` synthesis | ✅ Deployed |

### Query Flow

```
User Message → Platform Webhook (Telegram/GitHub)
                        │
                        ▼
            CloudflareChatAgent.handle()
                        │
              shouldRoute(userId)?
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
    NO: Direct chat()         YES: routeQuery()
    (LLM + Tools)                    │
           │                         ▼
           │               RouterAgent.route()
           │                         │
           │               hybridClassify()
           │                         │
           │         ┌───────────────┼───────────────┐
           │         ▼               ▼               ▼
           │   SimpleAgent    OrchestratorAgent  HITLAgent
           │   (quick Q&A)    (task decompose)   (approval)
           │         │               │               │
           │         │     ┌─────────┼─────────┐     │
           │         │     ▼         ▼         ▼     │
           │         │  CodeWrkr  RsrchWrkr  GitHubWrkr
           │         │  (review)  (search)   (PRs)   │
           │         │               │               │
           └─────────┴───────────────┴───────────────┘
                                     │
                                     ▼
                            Response to User
```

### Durable Objects (per bot)

| DO | Purpose | State |
|----|---------|-------|
| `TelegramAgent`/`GitHubAgent` | Main entry, transport | Messages, metadata |
| `RouterAgent` | Query classification | Routing history |
| `SimpleAgent` | Quick responses | Conversation |
| `HITLAgent` | Tool confirmations | Pending approvals |
| `OrchestratorAgent` | Task planning | Execution plans |
| `CodeWorker` | Code analysis | Stateless |
| `ResearchWorker` | Web research | Stateless |
| `GitHubWorker` | GitHub ops | Stateless |

See [docs/architecture.md](./docs/architecture.md) for detailed documentation.

## Quick Start

```bash
# Clone and install
git clone https://github.com/duyet/duyetbot-agent.git
cd duyetbot-agent
pnpm install

# Build and test
pnpm run build
pnpm test

# Start development
pnpm run dev
```

## Documentation

Full documentation available at **[duyet.github.io/duyetbot-agent](https://duyet.github.io/duyetbot-agent)**

- [Getting Started](https://duyet.github.io/duyetbot-agent/GETTING_STARTED) - Installation and configuration
- [Use Cases](https://duyet.github.io/duyetbot-agent/USECASES) - What you can do with @duyetbot
- [Architecture](https://duyet.github.io/duyetbot-agent/ARCHITECTURE) - System design
- [API Reference](https://duyet.github.io/duyetbot-agent/API) - Endpoints and schemas
- [Deployment](https://duyet.github.io/duyetbot-agent/DEPLOY) - Deploy to Railway, Fly.io, AWS
- [Contributing](https://duyet.github.io/duyetbot-agent/CONTRIBUTING) - How to contribute

## Project Status

See [PLAN.md](./PLAN.md) for detailed roadmap and current progress.

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with Claude Code**
