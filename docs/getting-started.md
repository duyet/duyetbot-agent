# Getting Started

**Related:** [Use Cases](usecases.md) | [Architecture](architecture.md) | [API Reference](api.md) | [Deployment](deploy.md)

Complete guide to installing, configuring, and running duyetbot-agent.

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **GitHub account** (for OAuth and GitHub Bot)
- **LLM API key** (Anthropic, OpenAI, or OpenRouter)

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/duyet/duyetbot-agent.git
cd duyetbot-agent
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build All Packages

```bash
pnpm run build
```

### 4. Run Tests

```bash
pnpm test
```

All 399 tests should pass.

---

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# LLM Provider Keys (at least one required)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...

# GitHub OAuth (for CLI cloud sync)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# GitHub Bot (for webhook integration)
BOT_USERNAME=duyetbot
GITHUB_TOKEN=ghp_xxx
WEBHOOK_SECRET=your_webhook_secret

# MCP Memory Server (optional)
MCP_SERVER_URL=https://memory.duyetbot.workers.dev
MCP_AUTH_TOKEN=xxx

# Server Configuration
PORT=3001
NODE_ENV=development
```

### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set callback URL: `http://localhost:3001/auth/github/callback`
4. Copy Client ID and Client Secret to `.env`

### LLM Provider Configuration

The system supports multiple providers with format `<provider>:<model_id>`:

| Provider | Format | Example |
|----------|--------|---------|
| Anthropic | `claude:<model>` | `claude:claude-3-5-sonnet-20241022` |
| OpenAI | `openai:<model>` | `openai:gpt-4-turbo` |
| OpenRouter | `openrouter:<model>` | `openrouter:anthropic/claude-3.5-sonnet` |

---

## Development

### Start Development Server

```bash
pnpm run dev
```

This starts all packages in watch mode.

### Run Specific Package

```bash
# CLI only
pnpm run dev --filter @duyetbot/cli

# GitHub Bot only
pnpm run dev --filter @duyetbot/github-bot

# Server only
pnpm run dev --filter @duyetbot/agent-server
```

### Code Quality

```bash
# Lint all code
pnpm run lint

# Fix lint issues
pnpm run lint:fix

# Type check
pnpm run type-check

# Format code
pnpm run format

# Run all checks
pnpm run check
```

### Testing

```bash
# All tests
pnpm test

# Watch mode
pnpm run test:watch

# Specific package
pnpm test --filter @duyetbot/core

# Coverage report
pnpm run test:coverage
```

---

## Project Structure

```
duyetbot-agent/
├── apps/
│   ├── github-bot/        # GitHub App webhook handler
│   ├── telegram-bot/      # Telegram bot
│   ├── memory-mcp/        # MCP memory server (Cloudflare Workers)
│   └── agent-server/      # Long-running agent server
├── packages/
│   ├── cli/               # Command-line interface
│   ├── core/              # Agent core logic
│   ├── providers/         # LLM provider adapters
│   ├── tools/             # Tool implementations
│   └── types/             # Shared TypeScript types
├── infrastructure/
│   └── docker/            # Dockerfiles
├── docs/                  # Documentation
├── PLAN.md                # Development roadmap
└── CLAUDE.md              # Claude Code instructions
```

---

## CLI Usage

### Interactive Chat

```bash
pnpm run cli chat
```

### One-shot Questions

```bash
pnpm run cli ask "How do I implement rate limiting?"
```

### With Specific Provider

```bash
pnpm run cli chat --provider openai:gpt-4-turbo
```

### Session Management

```bash
# List sessions
pnpm run cli sessions list

# Continue session
pnpm run cli chat --session <session-id>
```

---

## GitHub Bot Usage

### Local Development

1. Use [smee.io](https://smee.io) for webhook forwarding:
```bash
npx smee -u https://smee.io/YOUR_CHANNEL -p 3001 -P /webhook
```

2. Start the bot:
```bash
pnpm run dev --filter @duyetbot/github-bot
```

3. Configure GitHub App webhook URL to your smee.io URL

### Testing Locally

1. Create a test issue in your repository
2. Comment: `@duyetbot hello`
3. Bot should respond within seconds

---

## Git Hooks

The project includes automatic quality checks before `git push`:

- Runs linting and auto-fixes
- Runs TypeScript type checking
- Runs all tests
- Prevents push if checks fail

Hooks are automatically installed via `pnpm install`. To bypass:

```bash
git push --no-verify
```

---

## Troubleshooting

### Build Failures

```bash
# Clean and rebuild
pnpm run clean
pnpm install
pnpm run build
```

### Test Failures

```bash
# Run specific test file
pnpm test -- --filter @duyetbot/core src/__tests__/session.test.ts
```

### TypeScript Errors

```bash
# Check types across all packages
pnpm run type-check
```

### Dependency Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules packages/*/node_modules apps/*/node_modules
pnpm install
```

---

## Next Steps

- [Use Cases](usecases.md) - See what you can do with @duyetbot
- [Architecture](architecture.md) - Understand the system design
- [Deployment](deploy.md) - Deploy to production
- [API Reference](api.md) - Explore the API endpoints
- [Contributing](contributing.md) - Contribute to the project
