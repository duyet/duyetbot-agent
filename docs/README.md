# duyetbot-agent Documentation

Autonomous bot agent system built on Claude Agent SDK.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- GitHub account (for GitHub Bot)

### Installation

```bash
# Clone the repository
git clone https://github.com/duyet/duyetbot-agent.git
cd duyetbot-agent

# Install dependencies
pnpm install

# Build all packages
pnpm run build
```

### Quick Start

```bash
# Run the CLI
pnpm run cli

# Start the development server
pnpm run dev

# Run tests
pnpm test
```

## Documentation

- [Deployment Guide](DEPLOY.md) - Deploy to Railway, Fly.io, Render, AWS
- [Architecture](ARCHITECTURE.md) - System design and components

## Project Structure

```
duyetbot-agent/
├── apps/
│   └── github-bot/     # GitHub App bot
├── packages/
│   ├── cli/            # Command-line interface
│   ├── core/           # Core agent logic
│   ├── providers/      # LLM provider adapters
│   ├── tools/          # Tool implementations
│   ├── server/         # HTTP server
│   ├── memory-mcp/     # MCP memory server
│   └── types/          # Shared types
├── infrastructure/
│   └── docker/         # Dockerfiles
└── docs/               # Documentation
```

## Features

- **Multi-LLM Support**: Claude, OpenAI, OpenRouter
- **GitHub Bot**: Responds to mentions in issues/PRs
- **Session Management**: Persistent conversation history
- **MCP Integration**: Memory server for context storage
- **Extensible Tools**: bash, git, research, plan, sleep

## Quick Links

- [GitHub Repository](https://github.com/duyet/duyetbot-agent)
- [Report Issues](https://github.com/duyet/duyetbot-agent/issues)
