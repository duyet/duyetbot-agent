# duyetbot-agent

**Autonomous AI agent with persistent memory across CLI, GitHub, and Telegram**

---

## What is duyetbot?

duyetbot is your personal AI assistant that remembers context across all interfaces. Unlike traditional chatbots that forget between sessions, duyetbot maintains persistent memory of your conversations, code context, and preferences.

**Built with:** Claude Agent SDK (core engine), Cloudflare Workers, TypeScript

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

### Edge Deployment

Global low latency on Cloudflare Workers with D1, KV, and R2 storage.

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
│   └── github-bot/        # GitHub webhook handler
├── packages/
│   ├── cli/               # Command-line interface
│   ├── core/              # Agent core logic
│   ├── providers/         # LLM adapters
│   ├── tools/             # Agent tools
│   ├── server/            # HTTP API
│   └── memory-mcp/        # MCP memory server
└── docs/                  # Documentation
```

---

## Status

**Phase 7 Nearly Complete**: Claude Agent SDK as core engine with full Anthropic API integration, retry logic, tool execution, CLI streaming with interrupt support, token tracking. 443 tests passing.

**Remaining**: Server SDK integration, Ink UI improvements

**Next**: Phase 8 - Telegram Bot Integration

See [PLAN.md](https://github.com/duyet/duyetbot-agent/blob/master/PLAN.md) for full roadmap.

---

## Links

- [GitHub Repository](https://github.com/duyet/duyetbot-agent)
- [Report Issues](https://github.com/duyet/duyetbot-agent/issues)
- [Discussions](https://github.com/duyet/duyetbot-agent/discussions)

---

**443 tests passing** | **MIT License** | **Built with Claude Code**
