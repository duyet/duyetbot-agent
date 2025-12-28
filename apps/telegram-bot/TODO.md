# Telegram Bot TODO

## Overview

Continuous improvement roadmap for `apps/telegram-bot` to evolve into an autonomous AI agent system with best-in-class Telegram UX.

**Current State**:
- 126 tests passing (unit + E2E)
- ~6,630 LOC in src/
- Transport layer pattern implemented
- Event Bridge notification system (recently added)
- Fire-and-forget webhook processing

---

## Priority 1: Core Reliability & Security

### 1.1 Rate Limiting & Throttling
**Status**: `pending`
**Effort**: 2-3 hours
**Impact**: Prevents abuse, reduces API costs

- [ ] Implement per-user rate limiting in Durable Object
- [ ] Add burst detection for spam prevention
- [ ] Configure Telegram Bot API rate limit awareness (30 msg/sec)
- [ ] Add metrics for rate limit hits

**Files**: `src/agent.ts`, `src/middlewares/rate-limit.ts` (new)

---

### 1.2 Webhook Signature Verification
**Status**: `pending`
**Effort**: 1-2 hours
**Impact**: Security hardening

- [ ] Implement Telegram webhook secret validation
- [ ] Add timing attack protection for secret comparison
- [ ] Test with invalid signatures
- [ ] Document setup in deployment.md

**Files**: `src/middlewares/index.ts`, `src/index.ts`

**Note**: `TELEGRAM_WEBHOOK_SECRET` env var exists but not validated

---

### 1.3 Error Recovery & Dead Letter Queue
**Status**: `pending`
**Effort**: 3-4 hours
**Impact**: Prevents message loss

- [ ] Implement DLQ for failed RPC calls to agent
- [ ] Add retry logic with exponential backoff
- [ ] Store failed events in D1 for manual inspection
- [ ] Admin command to replay failed messages

**Files**: `src/index.ts`, `packages/cloudflare-agent/src/cloudflare-agent.ts`

---

## Priority 2: Telegram UX Enhancements

### 2.1 Inline Keyboards for Interactive Actions
**Status**: `pending`
**Effort**: 4-6 hours
**Impact**: Significant UX improvement

- [ ] Add `/settings` command with inline keyboard (model, voice, theme)
- [ ] Implement callback handler for settings updates
- [ ] Add `/clear` command with confirmation dialog
- [ ] Add `/export` command with format selection (JSON, Markdown)

**Files**: `src/commands/` (new), `src/middlewares/parser.ts`

**Note**: `receiveCallback()` RPC method exists (index.ts:157-218)

---

### 2.2 Typing Indicators & Progress Feedback
**Status**: `partial` (sendChatAction exists)
**Effort**: 2-3 hours
**Impact**: Perceived responsiveness

- [ ] Send "typing" indicator immediately on webhook receive
- [ ] Send "upload_document" during long tool executions
- [ ] Add progress updates for multi-step operations
- [ ] Test indicators in group chats

**Files**: `src/transport.ts` (has sendTypingIndicator), `src/index.ts`

---

### 2.3 Message Formatting & Rich Content
**Status**: `partial` (MarkdownV2/HTML support)
**Effort**: 3-4 hours
**Impact**: Better readability

- [ ] Add code block syntax highlighting detection
- [ ] Support inline images (via file_id or URL)
- [ ] Add link preview disable option
- [ ] Test parse mode fallback behavior

**Files**: `src/transport.ts`, `packages/prompts/src/telegram.ts`

---

## Priority 3: Admin & Observability Features

### 3.1 Admin Command System
**Status**: `pending`
**Effort**: 4-6 hours
**Impact**: Operational visibility

- [ ] `/admin stats` - usage statistics from D1
- [ ] `/admin users` - list active users
- [ ] `/admin errors` - recent error logs
- [ ] `/admin broadcast` - send announcement to all users

**Files**: `src/commands/admin.ts` (new)

---

### 3.2 Enhanced Debug Footer
**Status**: `partial` (exists in transport.ts:554-565)
**Effort**: 2-3 hours
**Impact**: Admin debugging experience

- [ ] Add token usage per message
- [ ] Add tool execution timeline
- [ ] Add collapsible sections for verbose info
- [ ] Add "/copy_debug" command to export JSON

**Files**: `src/debug-footer.ts`, `packages/cloudflare-agent/src/chat/platform-response.ts`

---

### 3.3 Observability Dashboard Queries
**Status**: `partial` (Event Bridge exists)
**Effort**: 3-4 hours
**Impact**: Production monitoring

- [ ] Add `/admin health` - check D1, DO, router status
- [ ] Add metrics export to observability_events
- [ ] Create Grafana dashboard queries
- [ ] Add alerting for error rate thresholds

**Files**: `src/commands/admin.ts`, `packages/observability/`

---

## Priority 4: Testing & Documentation

### 4.1 Increase Test Coverage
**Status**: `good` (126 tests passing)
**Effort**: 4-6 hours
**Impact**: Confidence in changes

- [ ] Add integration tests for rate limiting
- [ ] Add tests for callback query handling
- [ ] Add tests for admin commands
- [ ] Add tests for DLQ/retry logic

**Files**: `src/__tests__/` (expand)

---

### 4.2 E2E Tests for Critical Flows
**Status**: `good` (exists in `__tests__/e2e/`)
**Effort**: 4-6 hours
**Impact**: Production confidence

- [ ] Add E2E test for settings command flow
- [ ] Add E2E test for error/retry scenarios
- [ ] Add E2E test for group chat mentions
- [ ] Add performance benchmark test

**Files**: `src/__tests__/e2e/` (expand)

---

### 4.3 Documentation
**Status**: `partial` (CLAUDE.md exists)
**Effort**: 2-3 hours
**Impact**: Onboarding & maintenance

- [ ] Document admin commands in README
- [ ] Add troubleshooting guide for common issues
- [ ] Document deployment steps for new environments
- [ ] Add architecture diagrams

**Files**: `README.md` (new), `docs/` (new)

---

## Priority 5: Advanced Features

### 5.1 Multi-Language Support
**Status**: `pending`
**Effort**: 6-8 hours
**Impact**: International users

- [ ] Add `/language` command with inline keyboard
- [ ] Store user language preference in DO state
- [ ] Translate system prompts
- [ ] Add translatable help messages

**Files**: `src/i18n/` (new), `packages/prompts/`

---

### 5.2 Scheduled Tasks & Reminders
**Status**: `pending`
**Effort**: 6-8 hours
**Impact**: User engagement

- [ ] `/remind` command with natural time parsing
- [ ] Alarm-based reminder delivery
- [ ] Persistent reminder storage in D1
- [ ] Timezone awareness

**Files**: `src/commands/remind.ts` (new), `src/scheduled.ts`

---

### 5.3 Conversation Memory Improvements
**Status**: `partial` (maxHistory: 20)
**Effort**: 4-6 hours
**Impact**: Better context retention

- [ ] Implement semantic search for history pruning
- [ ] Add important message pinning
- [ ] Add conversation summarization
- [ ] Export/import conversation history

**Files**: `packages/cloudflare-agent/src/persistence/`

---

## Status Legend

- `pending` - Not started
- `partial` - Some implementation exists
- `done` - Complete

## Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage | 126 tests | 150+ tests |
| E2E Scenarios | 6 | 10+ |
| Admin Commands | 0 | 5+ |
| Documentation | Minimal | Comprehensive |

---

## Next Steps (Current Iteration)

1. **Immediate**: Implement Priority 1.1 (Rate Limiting)
2. **Then**: Add Priority 2.1 (Inline Keyboards)
3. **Finally**: Deploy and validate

---

*Last Updated: 2025-12-28 (Ralph Loop Iteration 1)*
