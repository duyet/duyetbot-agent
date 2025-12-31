# duyetbot-agent

```text
    __          __        _    __
   / /_  ____  / /___    | |  / /___ __      _
  / __ \/ __ \/ __/ _ \  | | / / __ `/ | /| / /
 / /_/ / /_/ / /_/  __/  | |/ / /_/ /| |/ |/ /
/_.___/\____/\__/\___/   |___/\__,_/ |__/|__//
              _   __         __        _
   ____  ___/ | / /__  ____/ /____ _/ |____
  / __ \/ _ \ / / / _ \/ __  / __ `/ __/ _ \
 / / / /  __/ / / /  __/ /_/ / /_/ / /_/  __/
/_/ /_/\___/_/_/_/\___/\__,_/\__,_/\__/\___/
          ________       __    __
         /  _/ __ \___ _/ /_  / /___  __  _
         / // /_/ / _ `/ / / / / __ \/ / / /
       _/ // _, _/  __/ / / / / /_/ / /_/ /
      /___/_/ |_|\___/_/ /_/_/ .___/\__, /
                            /_/    /____/
```

[![Tests](https://img.shields.io/badge/tests-969%2B-brightgreen)](https://github.com/duyet/duyetbot-agent)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-FAFAFA)](https://bun.sh/)

---

## Overview

**duyetbot-agent** is a personal AI agent system built for the edge. It implements a **loop-based agent architecture** with tool iterations, deployed on Cloudflare Workers + Durable Objects for GitHub (@mentions) and Telegram chat interfaces.

### Why This Architecture?

| Feature | Traditional | duyetbot-agent |
|---------|-------------|----------------|
| **Cold Start** | 1-5 seconds | <10ms (edge) |
| **State Management** | External database | Built-in (Durable Objects) |
| **Idle Costs** | Always-on servers | Free (serverless) |
| **Scalability** | Manual scaling | Automatic global sharding |

---

## Architecture

### Full System Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Telegram   │  │    GitHub    │  │  OpenRouter  │  │  MCP Servers │   │
│  │   Bot API    │  │     API      │  │  (LLM API)   │  │  (optional)  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │           │
│         ▼                 ▼                 ▼                 ▼           │
└─────────┼─────────────────┼─────────────────┼─────────────────┼───────────┘
          │                 │                 │                 │
          │ Webhook         │ Webhook         │ AI Gateway      │ MCP Protocol
          │                 │                 │ (rate limit)    │
          │                 │                 │                 │
┌─────────┼─────────────────┼─────────────────┼─────────────────┼───────────┐
│         │                 │                 │                 │           │
│         ▼                 ▼                 │                 │           │
│  ┌──────────────┐  ┌──────────────┐        │                 │           │
│  │ Telegram Bot │  │  GitHub Bot  │        │                 │           │
│  │   (Worker)   │  │   (Worker)   │        │                 │           │
│  │              │  │              │        │                 │           │
│  │  • Webhook   │  │  • Webhook   │        │                 │           │
│  │  • Transport │  │  • Transport │        │                 │           │
│  └──────┬───────┘  └──────┬───────┘        │                 │           │
│         │                 │                 │                 │           │
│         └─────────┬───────┘                 │                 │           │
│                   │                         │                 │           │
│                   ▼                         │                 │           │
│  ┌──────────────────────────────────────┐   │                 │           │
│  │    CloudflareChatAgent (DO)          │◄──┼─────────────────┼───────────┤
│  │                                      │   │                 │           │
│  │  ╔══════════════════════════════╗    │   │                 │           │
│  │  ║     Chat Loop (Core)         ║    │   │                 │           │
│  │  ║   ┌────────────────────┐     ║    │   │                 │           │
│  │  ║   │ LLM Reasoning      │     ║    │   │                 │           │
│  │  ║   │ Tool Iterations    │     ║    │   │                 │           │
│  │  ║   │ Response Handling  │     ║    │   │                 │           │
│  │  ║   └────────────────────┘     ║    │   │                 │           │
│  │  ╚══════════════════════════════╝    │   │                 │           │
│  │                                      │   │                 │           │
│  │  ╔══════════════════════════════╗    │   │                 │           │
│  │  ║   Tool Executor              ║    │   │                 │           │
│  │  ║  ┌────────┐  ┌─────────┐    ║    │   │                 │           │
│  │  ║  │ Built- │  │   MCP   │    ║────┼───┼─────────────────┼───────────┤
│  │  ║  │  in    │──│  Tools  │    ║    │   │                 │           │
│  │  ║  │ Tools  │  │         │    ║    │   │                 │           │
│  │  ║  └────────┘  └─────────┘    ║    │   │                 │           │
│  │  ╚══════════════════════════════╝    │   │                 │           │
│  │                                      │   │                 │           │
│  │  ╔══════════════════════════════╗    │   │                 │           │
│  │  ║   Token Tracker              ║────┼───┼─────────────────┼───────────┤
│  │  ║   • Usage tracking           ║    │   │                 │           │
│  │  ║   • Cost calculation         ║    │   │                 │           │
│  │  ║   • D1 persistence           ║    │   │                 │           │
│  │  ╚══════════════════════════════╝    │   │                 │           │
│  │                                      │   │                 │           │
│  │  ╔══════════════════════════════╗    │   │                 │           │
│  │  ║   Message Store              ║    │   │                 │           │
│  │  ║   • Conversation history     ║    │   │                 │           │
│  │  ║   • Session persistence      ║    │   │                 │           │
│  │  ╚══════════════════════════════╝    │   │                 │           │
│  └──────────────────────────────────────┘   │                 │           │
│                                             │                 │           │
│  ┌──────────────────────────────────────┐   │                 │           │
│  │    Memory MCP Server (Worker)       │◄──┼─────────────────┼───────────┤
│  │                                      │   │                 │           │
│  │  • Cross-session memory             │   │                 │           │
│  │  • User isolation                   │   │                 │           │
│  │  • D1 + KV storage                  │   │                 │           │
│  │  • MCP protocol endpoint            │───┼─────────────────┼───────────┤
│  └──────────────────────────────────────┘   │                 │           │
│                                             │                 │           │
│  ┌──────────────────────────────────────┐   │                 │           │
│  │    Safety Kernel (Worker)           │   │                 │           │
│  │                                      │   │                 │           │
│  │  • Health checks                    │   │                 │           │
│  │  • Rollback triggers                │   │                 │           │
│  │  • Dead man's switch                │   │                 │           │
│  └──────────────────────────────────────┘   │                 │           │
│                                             │                 │           │
│  ┌──────────────────────────────────────┐   │                 │           │
│  │    Web UI (Next.js)                 │   │                 │           │
│  │                                      │   │                 │           │
│  │  • Chat interface                   │   │                 │           │
│  │  • Agent playground                 │   │                 │           │
│  │  • Admin dashboard                  │   │                 │           │
│  └──────────────────────────────────────┘   │                 │           │
│                                             │                 │           │
│  ┌──────────────────────────────────────┐   │                 │           │
│  │    Analytics Dashboard (Next.js)     │   │                 │           │
│  │                                      │   │                 │           │
│  │  • Token usage visualization         │   │                 │           │
│  │  • Cost tracking                     │   │                 │           │
│  │  • Performance metrics               │   │                 │           │
│  └──────────────────────────────────────┘   │                 │           │
│                                             │                 │           │
└─────────────────────────────────────────────┼─────────────────┼───────────┘
                                              │                 │
                                              ▼                 ▼
                                      ┌──────────────┐  ┌──────────────┐
                                      │ Cloudflare   │  │   Custom     │
                                      │ D1 Database  │  │   MCP        │
                                      │              │  │   Servers    │
                                      │ • Messages   │  │              │
                                      │ • Tokens     │  │ • duyet-mcp  │
                                      │ • Sessions   │  │ • github-mcp │
                                      └──────────────┘  └──────────────┘
```

### Loop-Based Agent Flow

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         Chat Loop Execution Flow                            │
└────────────────────────────────────────────────────────────────────────────┘

User Message Arrives
        │
        ▼
┌───────────────────────┐
│  Webhook Ingestion    │
│  • Parse & validate   │
│  • Get/create DO      │
│  • Queue message      │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Batch Processing     │
│  • 500ms window       │
│  • Combine messages   │
│  • Start alarm        │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Send "Thinking..."   │
│  • Typing indicator   │
│  • Get messageRef     │
│  • Start rotation     │
└───────────┬───────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CHAT LOOP (Iterative)                      │
│                                                                 │
│  while (needs_tool_use) {                                      │
│      │                                                          │
│      ├─► Call LLM with context + tools                         │
│      │   │                                                      │
│      │   ├─► If tool_use detected:                             │
│      │   │   │                                                  │
│      │   │   ├─► Update: "Running {tool}..."                   │
│      │   │   │                                                  │
│      │   │   ├─► Execute tool (built-in or MCP)                │
│      │   │   │   ├─ bash: Shell commands                      │
│      │   │   │   ├─ git: Git operations                       │
│      │   │   │   ├─ github: GitHub API                        │
│      │   │   │   ├─ research: Web search                      │
│      │   │   │   └─ plan: Task planning                       │
│      │   │   │                                                  │
│      │   │   ├─► Collect tool results                         │
│      │   │   │                                                  │
│      │   │   └─► Feed results back to LLM                     │
│      │   │                                                      │
│      │   └─► If no tool_use:                                   │
│      │       ├─ Extract final response                        │
│      │       └─ Break loop                                    │
│  }                                                              │
│                                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Edit Message     │
                    │ • Final response │
                    │ • Debug footer   │
                    └─────────────────┘
```

### Tool System

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                          Tool Execution System                            │
└────────────────────────────────────────────────────────────────────────────┘

           LLM Request: tool_use
                  │
                  ▼
    ┌──────────────────────────┐
    │   Tool Executor          │
    │   (unified interface)    │
    └──────┬───────────┬───────┘
           │           │
    ┌──────┴───┐   ┌───┴────────┐
    │          │   │            │
    ▼          ▼   ▼            ▼
┌────────┐ ┌────────┐ ┌──────────────────┐
│ Built- │ │  MCP   │ │  MCP Servers      │
│  in    │ │ Tools │ │  (discovered)     │
│ Tools  │ │        │ │                  │
└────────┘ └────────┘ └──────────────────┘
    │          │              │
    │          │              └─► duyet-mcp (blog, info)
    │          │              └─► github-mcp (advanced ops)
    │          │              └─► Custom servers
    │          │
    ├─► bash    │          (External HTTP calls)
    ├─► git     │
    ├─► github  │
    ├─► research│
    └─► plan    │
               │
    ┌──────────┴───────────┐
    │   Return to LLM      │
    │   (tool results)     │
    └──────────────────────┘
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Loop-Based Agent** | Single agent with LLM reasoning loop and tool iterations (replaced multi-agent routing, ~8000 LOC removed) |
| **Built-in Tools** | bash, git, github, research, plan - all executed through unified interface |
| **MCP Integration** | Extensible via Model Context Protocol servers |
| **Persistent Memory** | Cross-session context via memory-mcp server (D1 + KV) |
| **Edge Deployment** | Cloudflare Workers + Durable Objects for <10ms cold starts |
| **Multi-Platform** | Telegram chat + GitHub @mentions via transport abstraction |
| **Token Tracking** | Real-time usage and cost tracking stored in D1 |
| **Safety Kernel** | Health checks, rollback triggers, dead man's switch |
| **Web UI** | Next.js-based chat interface and admin dashboard |
| **Analytics** | Token usage visualization, cost tracking, performance metrics |

---

## Project Structure

### Monorepo Layout

```text
duyetbot-agent/
├── packages/
│   ├── cloudflare-agent/     # Loop-based agent (2000 LOC, 969 tests)
│   │   ├── chat/              # Chat loop, tool executor, response handler
│   │   ├── tracking/          # Token tracker, execution logger
│   │   ├── persistence/       # Message store, session manager
│   │   └── workflow/          # Step tracker, debug footer
│   ├── core/                  # SDK adapter, session manager, MCP client
│   ├── tools/                 # Built-in tools (bash, git, github, research, plan)
│   ├── providers/             # LLM providers (OpenRouter via AI Gateway)
│   ├── prompts/               # System prompts (Telegram, GitHub)
│   ├── types/                 # Shared types (Agent, Tool, Message, Provider)
│   ├── hono-middleware/       # Shared Hono utilities
│   ├── analytics/             # Analytics utilities for dashboard
│   ├── observability/         # Logging, metrics, tracing
│   ├── progress/              # Progress tracking utilities
│   ├── cli/                   # Command-line interface
│   ├── api-security/          # API security utilities
│   └── mcp-servers/           # MCP server configurations
│
├── apps/
│   ├── telegram-bot/          # Telegram chat interface (Workers + DO)
│   ├── github-bot/            # GitHub @mention handler (Workers + DO)
│   ├── memory-mcp/            # Memory persistence server (Workers + D1)
│   ├── safety-kernel/         # Health checks & rollback (Workers)
│   ├── web/                   # Web UI (Next.js + Cloudflare)
│   ├── dashboard/             # Analytics dashboard (Next.js + OpenNext)
│   └── docs/                  # Documentation site
│
├── prompts-eval/              # Prompt evaluation with promptfoo
├── scripts/                   # Build & deployment scripts
├── docs/                      # Project documentation
├── CLAUDE.md                  # Claude Code guidance
└── PLAN.md                    # Implementation roadmap
```

### Package Dependencies

```text
                    @duyetbot/types
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  @duyetbot/        @duyetbot/        @duyetbot/
   providers          tools            prompts
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                    @duyetbot/core
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  @duyetbot/         @duyetbot/        @duyetbot/
 cloudflare-agent    analytics       observability
         │
         ├─────────────┬─────────────┬────────────┐
         │             │             │            │
         ▼             ▼             ▼            ▼
  telegram-bot   github-bot   memory-mcp   safety-kernel
```

---

## Quick Start

### Prerequisites

- **Bun** >= 1.3.3
- **Node.js** >= 20 (for some tools)
- **Cloudflare Account** (free tier works)
- **OpenRouter API Key** ([get one here](https://openrouter.ai/))

### Installation

```bash
# Clone repository
git clone https://github.com/duyet/duyetbot-agent.git
cd duyetbot-agent

# Install dependencies
bun install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Development

```bash
# Watch mode for all packages
bun run dev

# Run tests (969+ tests)
bun run test

# Lint + type-check
bun run check

# Build all packages
bun run build
```

### Local Development by App

```bash
# Telegram bot (wrangler dev)
cd apps/telegram-bot
bun run dev

# GitHub bot (wrangler dev)
cd apps/github-bot
bun run dev

# Memory MCP (wrangler dev)
cd apps/memory-mcp
bun run dev

# Web UI (Next.js dev)
cd apps/web
bun run dev

# Analytics dashboard (Next.js dev)
cd apps/dashboard
bun run dev
```

---

## Deployment

### Deploy All Services

```bash
# Deploy everything (includes dependencies)
bun run deploy
```

### Deploy Individual Services

```bash
# Deploy telegram bot + dependencies
bun run deploy:telegram

# Deploy github bot + dependencies
bun run deploy:github

# Deploy memory MCP + dependencies
bun run deploy:memory-mcp

# Deploy safety kernel
bun run deploy:safety-kernel

# Deploy web UI
bun run deploy:web

# Deploy analytics dashboard
bun run deploy:dashboard
```

### Configure Secrets

```bash
# Configure all secrets at once
bun run config

# Configure individual service
bun run config:telegram
bun run config:github
bun run config:memory-mcp
bun run config:web
bun run config:safety-kernel

# Show current secrets
bun run config:show
```

### Required Secrets

| Secret | Required For | Purpose |
|--------|--------------|---------|
| `OPENROUTER_API_KEY` | All apps | LLM provider access |
| `AI_GATEWAY_BASE_URL` | All apps | Cloudflare AI Gateway endpoint |
| `TELEGRAM_BOT_TOKEN` | telegram-bot | Telegram Bot API |
| `GITHUB_TOKEN` | github-bot | GitHub API access |
| `GITHUB_WEBHOOK_SECRET` | github-bot | Webhook verification |

### CI/CD Deployment

```bash
# Single app deployment (no dependency rebuild)
bun run ci:deploy:telegram
bun run ci:deploy:github
bun run ci:deploy:memory-mcp
bun run ci:deploy:safety-kernel
bun run ci:deploy:dashboard
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/architecture.md) | System design, routing flow, patterns |
| [Getting Started](./docs/getting-started.md) | Setup guide for new developers |
| [API Reference](./docs/api.md) | API endpoints and interfaces |
| [Deployment](./docs/deployment.md) | Detailed deployment guide |
| [PLAN.md](./PLAN.md) | Implementation roadmap and status |
| [Code Browse](https://zread.ai/duyet/duyetbot-agent) | Browse code on zread.ai |

---

## Transport Layer Pattern

The **Transport Layer** enables clean separation between platform-specific and agent logic:

```typescript
interface Transport<TContext> {
  // Send message, get reference for edits
  send(ctx: TContext, text: string): Promise<MessageRef>;

  // Edit existing message (for streaming updates)
  edit?(ctx: TContext, ref: MessageRef, text: string): Promise<void>;

  // Show typing indicator
  typing?(ctx: TContext): Promise<void>;

  // Add emoji reaction
  react?(ctx: TContext, ref: MessageRef, emoji: string): Promise<void>;

  // Extract normalized input from platform context
  parseContext(ctx: TContext): ParsedInput;
}
```

### Benefits

| Aspect | Without Transport | With Transport |
|--------|------------------|----------------|
| **App boilerplate** | ~300 lines | ~50 lines |
| **Duplicate logic** | Across apps | None |
| **New platform** | Copy entire app | Just add transport |
| **Testing** | Hard (mixed concerns) | Easy (mock transport) |

### Implementations

- **Telegram**: Message splitting, parse mode fallback, admin debug footer
- **GitHub**: Context enrichment, emoji reactions, comment threading

---

## Testing

**969+ tests** across all packages:

```bash
# All tests
bun run test

# Specific package
bun run test --filter @duyetbot/cloudflare-agent

# Watch mode
bun run test:watch

# Coverage report
bun run test -- --coverage
```

### Test Breakdown

| Package | Tests | Coverage |
|---------|-------|----------|
| `@duyetbot/cloudflare-agent` | 969 | High |
| `@duyetbot/core` | 32 | High |
| `@duyetbot/tools` | 24 | High |
| `@duyetbot/prompts` | 18 | High |

---

## Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Bun + TypeScript |
| **Framework** | Hono (Workers), Next.js 15 (Web) |
| **Deployment** | Cloudflare Workers + Durable Objects |
| **Database** | Cloudflare D1 + KV |
| **Testing** | Vitest + Playwright |
| **LLM Provider** | OpenRouter via AI Gateway |
| **Protocol** | Model Context Protocol (MCP) |

---

## Architecture Evolution

### From Multi-Agent to Loop-Based (December 2024)

| Aspect | Before (Multi-Agent) | After (Loop-Based) |
|--------|---------------------|-------------------|
| **Architecture** | 8 specialized agents | 1 agent + tools |
| **Code Size** | ~8000 LOC | ~2000 LOC |
| **Real-time Updates** | Lost in routing | Every tool iteration |
| **Debugging** | Cross-agent traces | Single execution thread |
| **Context** | Fragmented per agent | Unified conversation |
| **Test Count** | 1420+ tests | 969 tests |
| **Maintenance** | Complex routing logic | Simple tool interface |

### What Changed

**Removed:**
- RouterAgent, SimpleAgent, OrchestratorAgent, HITLAgent
- CodeWorker, ResearchWorker, GitHubWorker, DuyetInfoAgent
- `apps/shared-agents` (entire app deleted)
- Routing infrastructure (~8000 LOC)

**Added:**
- Loop-based chat loop with tool iterations
- Built-in tools: bash, git, github, research, plan
- MCP tool integration
- Real-time progress updates
- Unified conversation context

---

## Contributing

See [CLAUDE.md](./CLAUDE.md) for development workflow and guidelines.

**Key Principles:**
- Evidence-based decisions over assumptions
- Code over documentation
- Efficiency over verbosity
- No technical debt (early stage, no backward compatibility)

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with [Claude Code](https://claude.com/claude-code)**
