# duyetbot-agent

Autonomous bot agent system with multi-LLM support running on Cloudflare Workers.

## Features

- **Multi-LLM Support**: Claude, OpenAI, and OpenRouter integration
- **Background Task Scheduling**: Cron-like task execution with natural language input
- **Sub-Agent System**: Hierarchical agents with custom model configuration
- **Markdown Configuration**: Simple configuration via markdown files
- **Web UI**: Clean, minimalist interface for task management
- **Cloudflare Workers**: Serverless deployment with Sandbox SDK integration

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or pnpm
- Cloudflare account (for deployment)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

### Development Commands

```bash
# Development
npm run dev                  # Start local development server (port 8787)
npm run build               # Build for production
npm run type-check          # TypeScript type checking

# Testing
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests

# Code Quality
npm run lint                # Check code with Biome
npm run lint:fix            # Auto-fix linting issues
npm run format              # Format code with Biome
npm run check               # Run all checks (lint + type-check)

# Deployment
npm run deploy              # Deploy to Cloudflare Workers
npm run deploy:staging      # Deploy to staging
```

## Project Structure

```
duyetbot-agent/
├── src/
│   ├── index.ts              # Cloudflare Workers entry point
│   ├── agent/                # Core agent logic
│   ├── tools/                # Tool implementations
│   ├── providers/            # LLM provider adapters
│   ├── agents/               # Sub-agent system
│   ├── scheduler/            # Task scheduling
│   ├── config/               # Configuration parsing
│   ├── storage/              # KV/D1 persistence
│   └── ui/                   # Web interface
├── agents/                   # Agent configurations
├── tasks/                    # Task templates
├── tests/                    # Test files
├── CLAUDE.md                 # Development guide for Claude Code
└── PLAN.md                   # Implementation roadmap
```

## Configuration

### LLM Providers

Configure LLM providers using the format `<provider>:<model_id>`:

- `claude:claude-3-5-sonnet-20241022`
- `openai:gpt-4-turbo`
- `openrouter:anthropic/claude-3.5-sonnet`

### Environment Variables

```env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
AUTH_SECRET=your_secret_here
ENVIRONMENT=development
```

### Task Configuration

Create task files in `tasks/` directory:

```markdown
# My Task

## Schedule
0 9 * * *  # Daily at 9 AM

## Agent
researcher

## Input
Research the latest developments in AI
```

### Agent Configuration

Define custom agents in `agents/` directory:

```markdown
# Researcher

## Description
Agent specialized in web research and information gathering

## Model
claude:claude-3-5-sonnet-20241022

## Tools
- research
- bash
- git

## Prompt
You are a research specialist...
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guide and architecture
- [PLAN.md](./PLAN.md) - Implementation roadmap and progress tracking

## Development

This project follows a phased implementation approach. See [PLAN.md](./PLAN.md) for the detailed roadmap.

Current status: **Phase 1 - Project Foundation** ✅

## License

MIT
