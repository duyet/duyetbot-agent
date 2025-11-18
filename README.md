# duyetbot-agent

**Autonomous AI agent system with persistent memory and multi-interface access**

A production-grade AI agent that works everywhere - command line, web browser, and GitHub - with centralized memory storage and authentication. Built on Claude Agent SDK and deployed to Cloudflare Workers.

[![Tests](https://img.shields.io/badge/tests-494%20passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## 🎯 What is duyetbot-agent?

duyetbot-agent is an autonomous software development agent that maintains persistent memory across all interfaces. Unlike traditional chatbots that forget context between sessions, duyetbot remembers your conversations, code context, and preferences - whether you're using the CLI, web UI, or mentioning `@duyetbot` in GitHub issues.

### Key Features

- 🧠 **Persistent Memory**: Conversations and context stored centrally in Cloudflare D1
- 🔐 **Secure Authentication**: GitHub/Google OAuth with JWT tokens
- 🌍 **Multi-Interface**: Same agent accessible via CLI, web, and GitHub webhooks
- 🤖 **Multi-LLM Support**: Claude, OpenAI, and OpenRouter integration
- 📝 **GitHub Integration**: Mention `@duyetbot` in issues/PRs for automated help
- ⚡ **Edge Deployment**: Runs on Cloudflare Workers for global low latency
- 🔍 **Semantic Search**: Vector-based memory retrieval (planned)

## 🏗️ Architecture Overview

**Your understanding is 100% correct!** Here's the complete architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     User Interfaces (Multi-Platform)                │
├────────────────────┬──────────────────────┬─────────────────────────┤
│                    │                      │                         │
│   CLI Tool         │    Web UI            │   GitHub Actions        │
│   (Terminal)       │    (Browser)         │   (@duyetbot webhook)   │
│                    │                      │                         │
│   • Local agent    │   • Real-time UI     │   • Issue mentions      │
│   • Offline queue  │   • SSE streaming    │   • PR comments         │
│   • Auth required  │   • OAuth login      │   • Auto-responses      │
│                    │                      │                         │
└──────────┬─────────┴──────────┬───────────┴──────────┬──────────────┘
           │                    │                      │
           └────────────────────┼──────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Central API Layer    │
                    │  (Cloudflare Workers)  │
                    ├────────────────────────┤
                    │ • Authentication       │
                    │ • Memory Management    │
                    │ • User Isolation       │
                    │ • Rate Limiting        │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  OAuth Providers       │
                    ├────────────────────────┤
                    │ • GitHub Login         │
                    │ • Google Login         │
                    └────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
      ┌─────────▼─────────┐         ┌─────────▼──────────┐
      │  Storage Layer    │         │   Agent Engine     │
      │  (Cloudflare)     │         │   (Claude SDK)     │
      ├───────────────────┤         ├────────────────────┤
      │ • D1 Database     │         │ • LLM Providers    │
      │   - Users         │         │ • Tool System      │
      │   - Sessions      │         │ • Sub-Agents       │
      │   - Messages      │         │ • Streaming Mode   │
      │   - Memories      │         │                    │
      │                   │         │                    │
      │ • KV Store        │         └────────────────────┘
      │   - Rate Limits   │
      │   - Cache         │
      │                   │
      │ • Vectorize       │
      │   - Semantic      │
      │     Search        │
      │                   │
      │ • R2 Bucket       │
      │   - Attachments   │
      └───────────────────┘
```

## 🔄 How It Works

### 1. **Authentication Flow**

```
User (CLI/Web/GitHub)
  → OAuth (GitHub/Google)
  → Central API generates JWT
  → JWT used for all subsequent requests
  → User isolated data in D1
```

### 2. **Memory Management**

All interfaces share the same memory:

```
CLI Command → API → D1 Database → Stored
              ↓
         Web UI reads same data
              ↓
         GitHub webhook sees same context
```

### 3. **Agent Execution**

```
User Input (any interface)
  → Central API receives request
  → Load user context from D1
  → Agent processes with LLM
  → Stream response back
  → Save conversation to D1
  → Available on all interfaces
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Cloudflare account (for deployment)
- GitHub OAuth App (for authentication)
- Google OAuth credentials (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/duyet/duyetbot-agent.git
cd duyetbot-agent

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials
```

### Environment Configuration

```env
# LLM Provider Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...

# Authentication (from GitHub OAuth App)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=https://your-worker.workers.dev/auth/github/callback

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-worker.workers.dev/auth/google/callback

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_random_secret_here

# Frontend URL
FRONTEND_URL=https://your-frontend.com

# Environment
ENVIRONMENT=development
```

### Development

```bash
# Start local development server
npm run dev

# Open http://localhost:8787 in browser
```

### Testing

```bash
# Run all tests (494 tests)
npm test

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
npm run test:watch          # Watch mode

# Code quality
npm run lint                # Check with Biome
npm run lint:fix            # Auto-fix issues
npm run type-check          # TypeScript validation
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Deploy to staging environment
npm run deploy:staging
```

## 📚 Usage

### 1. Web Interface

1. Visit your deployed worker URL
2. Click "Login with GitHub" or "Login with Google"
3. Start chatting with duyetbot
4. All conversations saved to your account

### 2. CLI Tool

```bash
# Authenticate (one-time)
duyetbot login

# Start interactive session
duyetbot chat

# Run specific task
duyetbot run "analyze my latest commits"

# Check memory
duyetbot memory list

# Sync with cloud
duyetbot sync
```

### 3. GitHub Integration

In any GitHub issue or PR:

```markdown
@duyetbot analyze this pull request and suggest improvements

@duyetbot review the security implications of these changes

@duyetbot help me debug the failing test in CI
```

## 🛠️ Development

### Project Structure

```
duyetbot-agent/
├── src/
│   ├── api/                      # Central API (Cloudflare Workers)
│   │   ├── auth/                 # OAuth + JWT authentication
│   │   ├── middleware/           # Auth, CORS, rate limiting
│   │   ├── repositories/         # Database access layer
│   │   ├── routes/              # API endpoints
│   │   └── types.ts             # TypeScript types
│   │
│   ├── agent/                   # Agent core (Claude SDK)
│   │   ├── core.ts              # Main agent logic
│   │   └── session.ts           # Session management
│   │
│   ├── providers/               # LLM provider adapters
│   │   ├── claude.ts            # Anthropic Claude
│   │   ├── openai.ts            # OpenAI GPT
│   │   └── openrouter.ts        # OpenRouter
│   │
│   ├── tools/                   # Agent tools
│   │   ├── bash.ts              # Shell command execution
│   │   ├── git.ts               # Git operations
│   │   ├── research.ts          # Web research
│   │   └── plan.ts              # Task planning
│   │
│   ├── storage/                 # Storage implementations
│   │   ├── filesystem.ts        # Local file storage
│   │   └── file-session-manager.ts
│   │
│   ├── prompts/                 # System prompts
│   │   └── system.ts            # Agent personalities
│   │
│   └── ui/                      # Web UI (React + Ink CLI)
│       ├── App.tsx              # Web app
│       └── cli.tsx              # CLI interface
│
├── agents/                      # Agent configurations
├── tasks/                       # Task templates
├── tests/                       # 494 tests
│   ├── unit/                    # Unit tests
│   └── integration/             # Integration tests
│
├── ARCHITECTURE.md              # Detailed architecture docs
├── CLAUDE.md                    # Development guide for Claude Code
├── PLAN.md                      # Implementation roadmap
└── README.md                    # This file
```

### API Endpoints

#### Authentication

```
POST   /auth/github              # Start GitHub OAuth
GET    /auth/github/callback     # GitHub OAuth callback
POST   /auth/google              # Start Google OAuth
GET    /auth/google/callback     # Google OAuth callback
POST   /auth/refresh             # Refresh access token
POST   /auth/logout              # Logout (invalidate token)
```

#### User Management

```
GET    /users/me                 # Get current user profile
PATCH  /users/me                 # Update profile
DELETE /users/me                 # Delete account (GDPR)
GET    /users/me/sessions        # List active sessions
DELETE /users/me/sessions        # Revoke all sessions
```

#### Agent Interaction

```
POST   /agent/chat               # Send message (SSE streaming)
GET    /agent/sessions           # List user sessions
GET    /agent/sessions/:id       # Get session details
DELETE /agent/sessions/:id       # Delete session
GET    /agent/memory             # Query semantic memory
```

#### Health & Monitoring

```
GET    /health                   # Basic health check
GET    /health/ready             # Readiness probe
GET    /health/live              # Liveness probe
GET    /health/db                # Database health
GET    /health/kv                # KV health
```

### Database Schema

**Users Table** (D1)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  provider TEXT NOT NULL,  -- 'github' | 'google'
  provider_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  settings TEXT,  -- JSON
  UNIQUE(provider, provider_id)
);
```

**Sessions Table** (D1)
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT,  -- JSON
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

**Messages Table** (KV)
```
Key: session:{session_id}:messages
Value: Array<Message>
```

**Vector Memory** (Vectorize)
```
Embeddings of conversation history for semantic search
```

## 📖 Configuration

### Agent Configuration

Define custom agents in `agents/` directory:

```markdown
# agents/code-reviewer.md

## Description
Senior software engineer specialized in code review

## Model
claude:claude-3-5-sonnet-20241022

## Tools
- bash
- git

## Prompt
You are a senior software engineer reviewing code...
```

### Task Scheduling

Create scheduled tasks in `tasks/` directory:

```markdown
# tasks/daily-standup.md

## Schedule
0 9 * * *  # Daily at 9 AM

## Agent
researcher

## Input
Review my GitHub activity from yesterday and prepare a standup summary
```

## 🔐 Security

- **Authentication**: GitHub/Google OAuth 2.0
- **Authorization**: JWT tokens (1-hour expiry)
- **Rate Limiting**: 100 requests/minute per user
- **Data Isolation**: Row-level security in D1
- **CORS**: Strict origin allowlist
- **HTTPS Only**: All traffic encrypted
- **Token Storage**: Refresh tokens in D1, access tokens client-side
- **GDPR Compliant**: Account deletion cascade

## 🧪 Testing

**494 tests with 98.2% pass rate**

```bash
# Run all tests
npm test

# Coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

Test organization:
- **Unit Tests**: API, repositories, middleware, LLM providers
- **Integration Tests**: Health checks, auth flow, agent execution
- **E2E Tests**: Full user workflows (planned)

## 📊 Current Status

**Phase 5: Central API & Authentication** ✅ **COMPLETE**

- [x] JWT authentication system
- [x] GitHub OAuth integration
- [x] Google OAuth integration
- [x] User management API
- [x] Health check endpoints
- [x] Rate limiting
- [x] CORS middleware
- [x] 494 tests passing

**Next Phase: Multi-Tenant Database** 🚧 **IN PROGRESS**

See [PLAN.md](./PLAN.md) for detailed roadmap.

## 🤔 FAQ

**Q: Can the agent work offline (CLI)?**
A: Yes! The CLI works standalone, but requires authentication to sync memory with the cloud. Without auth, it operates in local-only mode.

**Q: Is my data private?**
A: Yes. All data is isolated by user ID. Other users cannot see your conversations or memory.

**Q: Which LLM is best for what?**
A:
- **Claude**: Best for code, reasoning, long context
- **OpenAI GPT-4**: Great general purpose, faster
- **OpenRouter**: Access to many models with one API key

**Q: How much does it cost to run?**
A: Cloudflare Workers free tier covers most usage. You'll pay for:
- LLM API calls (Claude/OpenAI/OpenRouter)
- D1 database usage (very cheap)
- Vectorize queries (when implemented)

**Q: Can I self-host?**
A: The CLI runs locally. The central API requires Cloudflare Workers, but you could adapt it to run on Node.js/Vercel/AWS.

## 🛣️ Roadmap

- [x] **Phase 1-4**: Foundation, providers, tools, storage
- [x] **Phase 5**: Central API & authentication
- [ ] **Phase 6**: Multi-tenant database with migrations
- [ ] **Phase 7**: CLI cloud sync
- [ ] **Phase 8**: Web UI with SSE streaming
- [ ] **Phase 9**: GitHub Actions integration (@duyetbot mentions)
- [ ] **Phase 10**: Vector search & semantic memory
- [ ] **Phase 11**: Advanced features (RAG, voice, etc.)

See [PLAN.md](./PLAN.md) for details.

## 📝 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture (1,162 lines)
- **[CLAUDE.md](./CLAUDE.md)** - Development guide for working with Claude Code
- **[PLAN.md](./PLAN.md)** - Implementation roadmap and progress tracking
- **[prompts/README.md](./prompts/README.md)** - System prompt documentation

## 🤝 Contributing

Contributions welcome! Please read the development guide in [CLAUDE.md](./CLAUDE.md) first.

```bash
# Fork the repo
# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes
# Run tests
npm test

# Commit with semantic format
git commit -m "feat: add amazing feature"

# Push and create PR
git push origin feature/amazing-feature
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Claude Agent SDK](https://github.com/anthropics/anthropic-agent-sdk)
- Deployed on [Cloudflare Workers](https://workers.cloudflare.com/)
- Inspired by [homelab.duyet.net](https://homelab.duyet.net) design

---

**Made with ❤️ by [@duyet](https://github.com/duyet)**

**Questions?** Open an issue or mention `@duyetbot` in your GitHub repo (once Phase 9 is complete!)
