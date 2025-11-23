# duyetbot-agent

**Autonomous AI agent with persistent memory across CLI, GitHub, and Telegram**

---

## What is duyetbot?

duyetbot is your personal AI assistant that remembers context across all interfaces. Unlike traditional chatbots that forget between sessions, duyetbot maintains persistent memory of your conversations, code context, and preferences.

**Built with:** Claude Agent SDK + Cloudflare Workflows (Supervisor) + Fly.io Machines (Worker) + Transport Layer Pattern

---

## Architecture

duyetbot uses a **Hybrid Supervisor-Worker Model** with a **Transport Layer Pattern**:

- **Transport Layer** - Platform-agnostic messaging (reduces app code by 80%)
- **Supervisor (Cloudflare Workflows)** - Orchestration, state management, human-in-the-loop
- **Worker (Fly.io Machines)** - Heavy compute, filesystem, Claude Agent SDK execution

This enables multi-day agent conversations with pay-per-use pricing (~$3.66/mo vs $58/mo always-on).

See [Architecture](architecture.md) for details.

---

## Quick Links

| | |
|---|---|
| [Getting Started](getting-started.md) | Installation, setup, and configuration |
| [Use Cases](usecases.md) | What you can do with @duyetbot |
| [Architecture](architecture.md) | System design and components |
| [API Reference](api.md) | Endpoints and schemas |
| [Deployment](deploy.md) | Deploy to Railway, Fly.io, AWS |
| [Contributing](contributing.md) | How to contribute |

---

## Features

### Multi-Interface Access

- **CLI** - Local development and quick queries
- **GitHub Bot** - PR reviews, issue management, code analysis
- **Telegram Bot** - Quick queries and notifications

### Persistent Memory

Your conversations are stored securely in Cloudflare D1. Ask follow-up questions days later - duyetbot remembers the context.

### Multi-LLM Support

Choose your preferred Claude-compatible model:
- **Claude** - Best for code and reasoning
- **Z.AI** - Claude via alternative endpoint
- **OpenRouter** - Access multiple models

### Hybrid Deployment

- **Transport Layer** - Simplified apps (~50 lines), easy platform addition
- **Cloudflare Workflows** - Durable orchestration, free sleep for days/weeks
- **Fly.io Machines** - On-demand compute with persistent volumes
- **MCP Memory** - Cross-session search on Cloudflare D1/KV

---

## Example Usage

### CLI

```bash
duyetbot chat
> Help me debug this TypeScript error
> Explain the previous error in simpler terms
```

### GitHub

```markdown
@duyetbot review this PR focusing on security
@duyetbot explain what this code does
@duyetbot merge when CI passes
```

### Telegram

```
/chat What's the best way to implement rate limiting?
/status Check my recent PRs
```

---

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

See [Getting Started](GETTING_STARTED.md) for detailed setup instructions.

---

## Project Structure

```
duyetbot-agent/
├── apps/
│   ├── github-bot/        # GitHub webhook handler + Transport
│   ├── telegram-bot/      # Telegram bot + Transport
│   ├── memory-mcp/        # MCP memory server (D1 + KV)
│   └── agent-server/      # Long-running agent server
├── packages/
│   ├── chat-agent/        # Transport Layer + agent abstraction
│   ├── cli/               # Command-line interface
│   ├── core/              # Agent core logic
│   ├── providers/         # LLM adapters
│   ├── tools/             # Agent tools
│   └── hono-middleware/   # Shared middleware
└── docs/                  # Documentation
```

---

## Status

**Architecture Updated**: Hybrid Supervisor-Worker Model with Cloudflare Workflows + Fly.io Machines. Volume-as-Session pattern for state persistence. Human-in-the-Loop via GitHub Checks API.

**Phase 7 Complete**: Claude Agent SDK as core engine with Anthropic API integration, retry logic, tool execution, CLI streaming with interrupt support. 443 tests passing.

**Next**: Phase 8 - Telegram Bot Integration

See [PLAN.md](https://github.com/duyet/duyetbot-agent/blob/master/PLAN.md) for full roadmap.

---

## Links

- [GitHub Repository](https://github.com/duyet/duyetbot-agent)
- [Report Issues](https://github.com/duyet/duyetbot-agent/issues)
- [Discussions](https://github.com/duyet/duyetbot-agent/discussions)

---

**443 tests passing** | **MIT License** | **Built with Claude Code**
