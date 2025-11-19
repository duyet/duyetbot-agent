# duyetbot-agent

**Autonomous AI agent system with persistent memory and multi-interface access**

Built on Claude Agent SDK and deployed to Cloudflare Workers, duyetbot-agent provides a production-grade AI agent accessible through CLI, web browser, and GitHub integrations.

[![Tests](https://img.shields.io/badge/tests-507%20passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## 🎯 Overview

duyetbot-agent is an autonomous software development agent that maintains persistent memory across all interfaces. Unlike traditional chatbots that forget context between sessions, duyetbot remembers your conversations, code context, and preferences across CLI, web UI, and GitHub mentions.

### Key Features

- 🧠 **Persistent Memory**: Centralized conversation storage in Cloudflare D1
- 🔐 **Secure Authentication**: GitHub/Google OAuth with JWT tokens
- 🌍 **Multi-Interface**: CLI, web, and GitHub webhook access
- 🤖 **Multi-LLM Support**: Claude, OpenAI, and OpenRouter
- 📝 **GitHub Integration**: Automated responses to `@duyetbot` mentions
- ⚡ **Edge Deployment**: Global low latency on Cloudflare Workers
- 🔍 **Semantic Search**: Vector-based memory retrieval (planned)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  User Interfaces                            │
├──────────────┬──────────────────┬──────────────────────────┤
│              │                  │                          │
│  CLI Tool    │   Web UI         │   GitHub Webhooks        │
│              │                  │                          │
└──────┬───────┴────────┬─────────┴───────┬─────────────────┘
       │                │                 │
       └────────────────┼─────────────────┘
                        │
            ┌───────────▼────────────┐
            │   Central API Layer    │
            │  (Cloudflare Workers)  │
            └───────────┬────────────┘
                        │
        ┌───────────────┴────────────────┐
        │                                │
┌───────▼─────────┐          ┌──────────▼──────────┐
│  Storage Layer  │          │   Agent Engine      │
│  (Cloudflare)   │          │   (Claude SDK)      │
├─────────────────┤          ├─────────────────────┤
│ • D1 Database   │          │ • LLM Providers     │
│ • KV Store      │          │ • Tool System       │
│ • Vectorize     │          │ • Sub-Agents        │
│ • R2 Bucket     │          │ • Streaming Mode    │
└─────────────────┘          └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Cloudflare account
- GitHub OAuth App
- Google OAuth credentials (optional)

### Installation

```bash
git clone https://github.com/duyet/duyetbot-agent.git
cd duyetbot-agent
npm install
cp .env.example .env
```

### Environment Configuration

```env
# LLM Provider Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...

# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=https://your-worker.workers.dev/auth/github/callback

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-worker.workers.dev/auth/google/callback

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_random_secret

# Environment
ENVIRONMENT=development
FRONTEND_URL=https://your-frontend.com
```

### Development

```bash
# Start local server (port 8787)
npm run dev

# Run tests
npm test

# Code quality
npm run lint
npm run type-check

# Install git hooks (auto-runs on npm install)
npm run prepare-hooks
```

**Git Hooks**: The project includes automatic quality checks before `git push`:
- Runs linting and auto-fixes issues
- Runs type checking
- Runs all tests
- Prevents push if checks fail

Hooks are automatically installed via `npm install`. To bypass temporarily: `git push --no-verify`

See [`.claude/README.md`](./.claude/README.md) for hook configuration details.

### Deployment

```bash
npm run deploy
```

## 📚 Usage

### Web Interface

1. Visit your deployed worker URL
2. Login with GitHub or Google
3. Start chatting with the agent
4. Conversations are automatically saved

### CLI Tool (Planned)

```bash
duyetbot login
duyetbot chat
duyetbot run "analyze my latest commits"
duyetbot memory list
```

### GitHub Integration (Planned)

```markdown
@duyetbot analyze this pull request and suggest improvements
@duyetbot review the security implications
@duyetbot help debug the failing test
```

## 🛠️ Development

### Project Structure

```
src/
├── api/                    # Central API (Cloudflare Workers)
│   ├── auth/              # OAuth + JWT authentication
│   ├── middleware/        # Auth, CORS, rate limiting
│   ├── repositories/      # Database access layer
│   └── routes/           # API endpoints
├── agent/                 # Agent core (Claude SDK)
├── providers/             # LLM provider adapters
├── tools/                 # Agent tools (bash, git, research)
├── storage/               # Storage implementations
├── prompts/               # System prompts
└── ui/                    # Web UI

tests/
├── unit/                  # Unit tests
└── integration/           # Integration tests
```

### API Endpoints

**Authentication**
- `POST /auth/github` - Start GitHub OAuth
- `GET /auth/github/callback` - OAuth callback
- `POST /auth/google` - Start Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout

**User Management**
- `GET /users/me` - Get profile
- `PATCH /users/me` - Update profile
- `DELETE /users/me` - Delete account (GDPR)
- `GET /users/me/sessions` - List sessions
- `DELETE /users/me/sessions` - Revoke sessions

**Agent Interaction**
- `POST /agent/chat` - Send message (SSE streaming)
- `GET /agent/sessions` - List sessions
- `GET /agent/sessions/:id` - Session details
- `DELETE /agent/sessions/:id` - Delete session
- `GET /agent/memory` - Query memory

**Health & Monitoring**
- `GET /health` - Health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /health/db` - Database health
- `GET /health/kv` - KV health

### Database Schema

**Users Table (D1)**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  settings TEXT,
  UNIQUE(provider, provider_id)
);
```

**Sessions Table (D1)**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
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
0 9 * * *

## Agent
researcher

## Input
Review GitHub activity and prepare standup summary
```

## 🔐 Security

- **Authentication**: GitHub/Google OAuth 2.0
- **Authorization**: JWT tokens (1-hour expiry)
- **Rate Limiting**: 100 requests/minute per user
- **Data Isolation**: User-scoped data in D1
- **CORS**: Strict origin allowlist
- **HTTPS Only**: All traffic encrypted
- **Token Storage**: Refresh tokens in D1
- **GDPR Compliant**: Account deletion cascade

## 🧪 Testing

```bash
npm test                    # Run all tests (507 passing)
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

Test organization:
- **Unit Tests**: API, repositories, middleware, providers
- **Integration Tests**: Health checks, auth flow, agent execution

## 📊 Current Status

**Phase 5: Central API & Authentication** ✅ **COMPLETE**

- [x] JWT authentication system
- [x] GitHub OAuth integration
- [x] Google OAuth integration
- [x] User management API
- [x] Health check endpoints
- [x] Rate limiting
- [x] CORS middleware
- [x] 507 tests passing

**Next Phase: Multi-Tenant Database** 🚧 **IN PROGRESS**

See [PLAN.md](./PLAN.md) for detailed roadmap.

## 🤔 FAQ

**Q: Can the agent work offline?**
A: CLI works standalone but requires authentication for cloud sync. Without auth, it operates in local-only mode.

**Q: Is my data private?**
A: Yes. All data is user-scoped. Other users cannot access your conversations or memory.

**Q: Which LLM should I use?**
A:
- **Claude**: Best for code, reasoning, long context
- **OpenAI GPT-4**: Fast general-purpose tasks
- **OpenRouter**: Access multiple models with one API

**Q: How much does it cost?**
A: Cloudflare Workers free tier covers most usage. You pay for:
- LLM API calls (Claude/OpenAI/OpenRouter)
- D1 database usage (minimal cost)
- Vectorize queries (when implemented)

**Q: Can I self-host?**
A: CLI runs locally. Central API requires Cloudflare Workers but can be adapted for Node.js/Vercel/AWS.

## 🛣️ Roadmap

- [x] **Phase 1-4**: Foundation, providers, tools, storage
- [x] **Phase 5**: Central API & authentication
- [ ] **Phase 6**: Multi-tenant database
- [ ] **Phase 7**: CLI cloud sync
- [ ] **Phase 8**: Web UI with SSE streaming
- [ ] **Phase 9**: GitHub Actions integration
- [ ] **Phase 10**: Vector search & semantic memory
- [ ] **Phase 11**: Advanced features (RAG, voice)

See [PLAN.md](./PLAN.md) for details.

## 📝 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[CLAUDE.md](./CLAUDE.md)** - Development guide for Claude Code
- **[PLAN.md](./PLAN.md)** - Implementation roadmap

## 🤝 Contributing

Contributions welcome! Please read [CLAUDE.md](./CLAUDE.md) first.

```bash
git checkout -b feature/amazing-feature
npm test
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Claude Agent SDK](https://github.com/anthropics/anthropic-agent-sdk)
- Deployed on [Cloudflare Workers](https://workers.cloudflare.com/)
- Inspired by [homelab.duyet.net](https://homelab.duyet.net)

---

**Built by [@duyetbot](https://github.com/apps/duyetbot) with Claude Code** 🤖
