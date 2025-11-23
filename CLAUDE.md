# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**duyetbot-agent** is an autonomous bot agent system built on the **Claude Agent SDK as its core engine**. It uses a monorepo architecture with pnpm workspaces, featuring a long-running container server and MCP-based memory layer.

### Core Capabilities
- **Claude Agent SDK as core engine** - Uses SDK's `query()` function as primary execution
- Claude-compatible LLM providers (Claude, Z.AI via base URL, OpenRouter)
- GitHub Bot integration (@duyetbot mentions)
- Telegram Bot for chat and notifications
- CLI with local and cloud modes
- MCP memory server on Cloudflare Workers (D1 + KV)
- Sub-agent system with SDK's native subagent delegation
- Streaming execution via async generators

## Architecture

### Technology Stack
- **Package Manager/Runtime**: Bun (with Turborepo for orchestration)
- **Agent Engine**: Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
- **Server Runtime**: Bun
- **Memory Layer**: Cloudflare Workers (D1 + KV + Vectorize)
- **Language**: TypeScript
- **Testing**: Vitest
- **API Framework**: Hono

### SDK-First Architecture

The Claude Agent SDK is the **core engine** of this system:

```
                    Applications (CLI, GitHub Bot, Telegram)
                                    │
                              Agent Runner
                                    │
                            ┌───────▼───────┐
                            │  SDK Adapter  │  ← Thin config layer
                            └───────┬───────┘
                                    │
                    ╔═══════════════▼════════════════╗
                    ║   Claude Agent SDK (Core)      ║
                    ║   • query() - main execution   ║
                    ║   • tool() - definitions       ║
                    ║   • MCP server connections     ║
                    ║   • Subagent delegation        ║
                    ╚════════════════════════════════╝
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
          Tools                MCP Memory              Claude API
```

### Core Packages

**1. Core Package** (`packages/core/`)
- SDK adapter layer (`sdk-engine/`)
- Session management
- MCP client for memory server

**2. Tools Package** (`packages/tools/`)
Built-in tools (SDK-compatible format):
- `bash`: Shell command execution
- `git`: Git operations
- `github`: GitHub API operations
- `research`: Web research
- `plan`: Task planning
- `sleep`: Execution delays

**3. Providers Package** (`packages/providers/`)
- Claude provider with base URL override support
- OpenRouter provider
- Z.AI support via base URL configuration

**4. CLI Package** (`packages/cli/`)
- Interactive chat
- Local and cloud modes
- GitHub OAuth authentication

### Applications

**1. GitHub Bot** (`apps/github-bot/`)
- @duyetbot mention handling
- PR reviews and issue management
- Webhook handlers

**2. Telegram Bot** (`apps/telegram-bot/`)
- Chat interface
- Notifications

**3. Memory MCP Server** (`apps/memory-mcp/`)
- Cloudflare Workers deployment
- D1 for metadata, KV for messages
- MCP tools: authenticate, get_memory, save_memory, search_memory

**4. Agent Server** (`apps/agent-server/`)
- Long-running agent server
- WebSocket streaming
- Graceful shutdown

## SDK Integration Pattern

### Using the SDK Engine

```typescript
import { executeQuery, createSDKOptions } from '@duyetbot/core/sdk-engine';
import { getAllSDKTools } from '@duyetbot/core/sdk-engine/tools';

const config = {
  model: 'sonnet',
  memoryServerUrl: 'https://memory.duyetbot.workers.dev',
  tools: getAllSDKTools(),
  systemPrompt: 'You are duyetbot...',
  sessionId: 'session-123',
  agents: [
    {
      name: 'researcher',
      description: 'Research and gather information',
      tools: ['research'],
      model: 'haiku',
    },
  ],
};

// Stream responses
for await (const message of executeQuery(userInput, config)) {
  if (message.type === 'assistant') {
    console.log(message.content);
  }
}
```

### Tool Definition (SDK Format)

```typescript
import { sdkTool } from '@duyetbot/core/sdk';
import { z } from 'zod';

const myTool = sdkTool(
  'my_tool',
  'Description of what this tool does',
  z.object({
    param: z.string().describe('Parameter description'),
  }),
  async ({ param }) => {
    // Tool implementation
    return { result: 'output' };
  }
);
```

## Development Commands

### Setup
```bash
bun install
```

### Development
```bash
bun run dev                     # Start all packages in dev mode
bun run build                   # Build all packages
bun run type-check              # TypeScript type checking
```

### Testing
```bash
bun run test                    # Run all tests
bun run test --filter @duyetbot/core   # Test specific package
```

### Linting and Formatting
```bash
bun run lint                    # Biome check
bun run lint:fix                # Auto-fix linting issues
bun run format                  # Format code with Biome
bun run check                   # Run all checks (lint + type-check)
```

### Deployment
```bash
bun run deploy                  # Deploy all apps (GitHub + Telegram bots)
bun run deploy:github           # Deploy GitHub bot only
bun run deploy:telegram         # Deploy Telegram bot only
```

### Package-Specific Commands
```bash
bun --filter @duyetbot/cli dev            # Run CLI in dev mode
bun --filter @duyetbot/agent-server dev   # Run server in dev mode
bun --filter @duyetbot/memory-mcp deploy  # Deploy MCP server
```

## Development Workflow

### IMPORTANT: Maintaining PLAN.md

**PLAN.md is a living document that tracks project progress. You MUST maintain it throughout development.**

#### Before Starting Work
1. **Always read PLAN.md first** to understand current phase, tasks, and dependencies

#### During Development
1. **Check off completed tasks** using `[x]` syntax immediately
2. **Update task status** if complexity changes

#### After Completing Work
1. **Update PLAN.md** with completed tasks and new discoveries
2. **Update the Revision History** table
3. **Commit PLAN.md** along with code changes

### Pre-Commit Checks

**IMPORTANT: Before committing and pushing, always ensure:**

1. **Lint passes**: `bun run lint` or `bun run lint:fix`
2. **Type check passes**: `bun run type-check`
3. **Tests pass**: `bun run test`

Or run all checks at once:
```bash
bun run check  # Runs lint + type-check
bun run test   # Runs all tests
```

The repository has a pre-push hook that runs these checks automatically. If the hook fails, fix the issues before pushing.

### Commit Message Guidelines

**Format**: `<type>: <description in lowercase>`

```bash
git commit -m "feat: add sdk streaming support"
git commit -m "fix: resolve session manager error"
git commit -m "docs: update PLAN.md with phase 7 progress"
```

**Semantic Types**: feat, fix, docs, test, refactor, perf, chore, ci, build

## File Organization

```
duyetbot-agent/
├── packages/
│   ├── core/                    # Core agent logic
│   │   ├── src/
│   │   │   ├── agent/          # Agent orchestration
│   │   │   ├── sdk/            # SDK integration layer
│   │   │   │   ├── query.ts    # Query execution
│   │   │   │   ├── tool.ts     # Tool definitions
│   │   │   │   ├── options.ts  # Configuration
│   │   │   │   └── subagent.ts # Subagent system
│   │   │   └── mcp/            # MCP client
│   │   └── package.json
│   │
│   ├── providers/               # LLM providers
│   │   ├── src/
│   │   │   ├── claude.ts       # Claude with base URL support
│   │   │   ├── openrouter.ts
│   │   │   └── factory.ts
│   │   └── package.json
│   │
│   ├── tools/                   # Tool implementations
│   │   ├── src/
│   │   │   ├── bash.ts
│   │   │   ├── git.ts
│   │   │   ├── github.ts
│   │   │   ├── research.ts
│   │   │   └── registry.ts
│   │   └── package.json
│   │
│   ├── cli/                     # CLI tool
│   │   ├── src/
│   │   │   ├── commands/       # CLI commands
│   │   │   ├── ui/             # Ink components
│   │   │   └── auth/           # GitHub OAuth
│   │   └── package.json
│   │
│   └── types/                   # Shared TypeScript types
│       └── package.json
│
├── apps/
│   ├── github-bot/              # GitHub App
│   │   ├── src/
│   │   │   ├── webhooks/       # Webhook handlers
│   │   │   └── handlers/       # @duyetbot handlers
│   │   └── package.json
│   │
│   ├── telegram-bot/            # Telegram bot
│   │   └── package.json
│   │
│   ├── memory-mcp/              # MCP memory server (Cloudflare Workers)
│   │   ├── src/
│   │   │   ├── tools/          # MCP tools
│   │   │   ├── storage/        # D1/KV operations
│   │   │   └── auth/           # GitHub auth
│   │   └── package.json
│   │
│   └── agent-server/            # Long-running agent server
│       ├── src/
│       │   ├── routes/         # HTTP routes
│       │   ├── websocket.ts    # WebSocket server
│       │   └── session-manager.ts
│       └── package.json
│
├── infrastructure/
│   ├── docker/
│   │   └── docker-compose.yml
│   └── cloudflare/
│       └── wrangler.toml
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── CLAUDE.md
├── PLAN.md
└── README.md
```

## Configuration

### Environment Variables
```bash
# Claude API
ANTHROPIC_API_KEY=<key>
ANTHROPIC_BASE_URL=https://api.anthropic.com  # Or Z.AI URL

# OpenRouter
OPENROUTER_API_KEY=<key>

# Memory MCP Server
MCP_MEMORY_URL=https://memory.duyetbot.workers.dev

# GitHub
GITHUB_TOKEN=<token>

# Telegram
TELEGRAM_BOT_TOKEN=<token>
```

### Z.AI Support (Base URL Override)
```bash
# Use Z.AI instead of Claude
export ANTHROPIC_API_KEY="$ZAI_API_KEY"
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
```

## Testing

### Test Coverage
- **443 tests** across all packages
- Core: 101 tests (44 SDK tests)
- Providers: 38 tests
- Tools: 51 tests
- Memory-MCP: 93 tests
- CLI: 67 tests
- GitHub-Bot: 57 tests
- Server: 36 tests

### Running Tests
```bash
bun run test                              # All tests
bun run test --filter @duyetbot/core      # Core only
bun run test --filter @duyetbot/tools     # Tools only
```

## Key Patterns

### SDK Query Execution
```typescript
// Direct SDK passthrough
for await (const message of sdkQuery(input, options)) {
  yield message;
}
```

### Subagent Delegation
```typescript
const options = {
  agents: [
    {
      name: 'code_reviewer',
      description: 'Review code for quality',
      tools: ['bash', 'git'],
      model: 'sonnet',
    },
  ],
};
// SDK automatically delegates to subagent when appropriate
```

### MCP Memory Integration
```typescript
const config = {
  memoryServerUrl: 'https://memory.duyetbot.workers.dev',
  // SDK connects to MCP server and can use:
  // - get_memory, save_memory, search_memory, list_sessions
};
```

### Permission Modes
```typescript
const options = {
  permissionMode: 'default',        // Ask for approval
  // or 'acceptEdits'               // Auto-approve file edits
  // or 'bypassPermissions'         // Testing only
};
```

## References

- [Claude Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
