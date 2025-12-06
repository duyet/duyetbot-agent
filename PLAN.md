# duyetbot-agent Roadmap

## Current State

**duyetbot-agent** is a personal AI agent system deployed on Cloudflare Workers + Durable Objects.

### Deployed Components

| Component | Status | Description |
|-----------|--------|-------------|
| **telegram-bot** | Deployed | Telegram chat interface with TelegramAgent DO |
| **github-bot** | Deployed | GitHub @mention handler with GitHubAgent DO |
| **shared-agents** | Deployed | 8 shared Durable Objects (Router, Simple, HITL, Orchestrator, Workers) |
| **memory-mcp** | Deployed | Cross-session memory (D1 + KV) |
| **safety-kernel** | Deployed | Health checks and rollback |

### Multi-Agent Architecture

```
RouterAgent → Hybrid classifier (pattern + LLM)
    ├── SimpleAgent (quick Q&A)
    ├── OrchestratorAgent (task decomposition)
    │   ├── CodeWorker
    │   ├── ResearchWorker
    │   └── GitHubWorker
    ├── HITLAgent (human approval)
    └── DuyetInfoAgent (personal info)
```

### Key Features
- Hybrid classifier (pattern match + LLM fallback)
- Dual-batch queue with alarm-based processing
- Heartbeat mechanism with stuck detection
- Transport layer abstraction (~50 LOC per platform)
- Fire-and-forget webhook pattern

---

## Roadmap

### Phase 7: Vector Memory & Semantic Search

**Goal**: Enhanced memory with semantic search capabilities

- [ ] Vectorize integration for embeddings
- [ ] Semantic search across conversation history
- [ ] Similarity-based context retrieval
- [ ] Multi-user memory isolation
- [ ] Memory summarization for long conversations

**Dependencies**: Cloudflare Vectorize GA

### Phase 8: Web UI & Dashboard

**Goal**: User-facing interface for interaction and configuration

- [ ] Chat history browsing
- [ ] Agent configuration UI
- [ ] HITL approval interface (approve/reject from web)
- [ ] Usage analytics and metrics
- [ ] Session management

**Stack**: Cloudflare Pages + React/Next.js

### Phase 9: CLI Enhancement

**Goal**: Improve local development and interaction

- [ ] Interactive chat mode
- [ ] Session management commands
- [ ] Memory sync with cloud
- [ ] Offline mode with local LLM

### Phase 10: Advanced Orchestration

**Goal**: More sophisticated multi-agent coordination

- [ ] Dynamic agent spawning based on task complexity
- [ ] Agent-to-agent communication patterns
- [ ] Workflow persistence (long-running tasks)
- [ ] Cost optimization (token budget management)

### Phase 11: Observability & Debugging

**Goal**: Better visibility into agent behavior

- [ ] Structured logging with trace IDs
- [ ] Request tracing across agents
- [ ] Performance metrics dashboard
- [ ] Error aggregation and alerting

---

## Ideas Backlog

These are potential features without committed timelines:

- **Voice interface**: Telegram voice messages → text → response
- **Scheduled tasks**: Cron-based agent triggers
- **Multi-tenant support**: Shared infrastructure for multiple users
- **Plugin system**: User-defined tools and agents
- **RAG integration**: Document ingestion and retrieval

---

## Contributing

### Proposing Features

1. Open an issue with the `enhancement` label
2. Describe the use case and expected behavior
3. Reference any related Cloudflare features or limitations

### Development Workflow

See [CLAUDE.md](./CLAUDE.md) for:
- Development commands
- Commit message format
- Testing requirements
- Deployment process

---

## References

- [Architecture](./docs/architecture.md) - System design details
- [Cloudflare Agent Patterns](https://developers.cloudflare.com/agents/patterns/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
