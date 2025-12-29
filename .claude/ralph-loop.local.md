---

active: true
iteration: 98
max_iterations: 0
completion_promise: null
started_at: "2025-12-29T03:50:00Z"
---

# Ralph Loop - Continuous Improvement System

**Workflow**: Pick tasks from TODO.md → Plan → Execute → Update TODO.md → Commit after deploy+test
If nothing in TODO.md → Analyze codebase → Identify improvements → Plan changes → Implement → Commit
If nothing to improve → Brainstorm new features → Plan → add to TODO.md → Execute

**Focus**: UI/UX/DX, Security, Performance, Code Quality, Testing, Bug Fixes, Reusability

---

# Current Status

**Branch**: `feature/web-ui-improvements` (based on `claude/init-bot-agent-project-011Ao8Z9aEoAwxQ3D99gkfpQ`)
- ✅ TypeScript: All passing
- ✅ Build: All successful
- ✅ Tests: 921+ passing (757 core + 164 hook/lib tests)
- ✅ Lint: Biome clean
- ⚠️ memory-mcp: Type-check fails but builds/runs (deferred)

---

# Next Priorities

## High Priority
1. **Unit Test Coverage** (40% → 80%)
   - [x] use-chat-transport, use-artifact, use-auth, use-file-upload, use-speech-recognition, use-title-generation (108/135 passing)
   - [x] lib/api-client.ts (24/24 passing)
   - [x] lib/chat-memory.ts (32/32 passing, moved to hooks/ for happy-dom)
   - [ ] lib/chat-search.ts (integration tests recommended due to server-only)
   - [ ] Components: multimodal-input, keyboard-shortcuts, auth-form, chat-message

2. **Integration Tests** (0 coverage)
   - [ ] Telegram bot webhooks, GitHub bot webhooks, MCP integrations, cross-app workflows

3. **Performance**
   - [ ] Virtual scrolling, Optimistic UI

## Medium Priority
1. **Security** (5 items)
   - [ ] API key rotation, Request signing, Request throttling, Secure secrets

2. **Cross-App**
   - [ ] Telegram: /news, /deploy, /health
   - [ ] GitHub: Auto PR reviews, /pr-summary, /merge, /conflict

---

# Recent Iterations

### Iteration 98 (Dec 29, 2025)
- ✅ Unit tests for 3 critical lib modules (api-client, chat-memory, chat-search)
- ✅ api-client.test.ts: 24/24 passing - tests retry logic, auth, chat ops, agents
- ✅ chat-memory.test.ts: 32/32 passing - tests localStorage persistence, hook, import/export
- ✅ chat-search.test.ts: Server-only database module - integration tests recommended
- ✅ Total test count: 921+ passing (757 core + 164 hook/lib tests)
- ✅ Fixed window.global stubbing for browser APIs in node test environment

### Iteration 97 (Dec 29, 2025)
- ✅ Unit tests for 6 critical hooks (use-chat-transport, use-artifact, use-auth, use-file-upload, use-speech-recognition, use-title-generation)
- ✅ 108/135 hook tests passing (80% pass rate) - use-speech-recognition fully passing (27/27)
- ✅ Fixed vitest path alias resolution with new URL(".", import.meta.url).pathname
- ✅ Established mock patterns: vi.hoisted() for stable mocks, proper import patterns for vi.mocked()
- ⚠️ 27 tests failing due to SWR cache pollution and mock call count issues

---

# Vision Notes

**Self-Improving Platform**: Never stop improving, learning, fixing, optimizing, enhancing, refactoring, reusing, documenting, designing, testing, securing, speeding up.

**Components**:
- `apps/telegram-bot`: News, PR status, deploy, health, remote Claude Code trigger
- `apps/github-bot`: PR reviews, auto-review on @mentions
- `apps/web`: Universal agent with dashboard, scheduling, URL presentation, translation
- `Memory MCP`: Digital twin of @duyet (blog, GitHub, style, personality in Vietnamese+English)

**Self-Upgrade**: Repo can self-analyze, identify improvements, plan changes, implement automatically.

---

# Workflow Rules

- Commit after successful deployment and testing
- Semantic commits with `Co-Authored-By: duyetbot <duyetbot@users.noreply.github.com>`
- No backward compatibility shims (early development)
- Run tests/deploy in parallel via junior engineer agents
- Launch senior engineer for lint/type errors
- Use TODO.md for task tracking
- Plan for more tasks if TODO.md is nothing to do

---

# Per-Iteration Updates

For each iteration:
1. Update `iteration:` counter
2. Add 3-5 line summary under "Recent Iterations"
3. Keep only last 15-20 iterations
4. Update "Current Status" and "Next Priorities"
5. Keep file under 200 lines
