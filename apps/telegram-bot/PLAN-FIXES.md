# Telegram Bot Fixes Implementation Plan

Based on the comprehensive analysis, this plan addresses all identified issues.

## Summary of Issues

| Priority | Issue | Location | Impact |
|----------|-------|----------|--------|
| 🔴 High | Webhook secret bypass in production | `telegram-auth.ts:15` | Security |
| 🟡 Medium | Unused `_githubMcpServer` definition | `agent.ts:32-39` | Code hygiene |
| 🟡 Medium | Missing tests for transport and authorization | `src/__tests__/` | Test coverage |
| 🟢 Low | Magic number in `splitMessage` | `transport.ts:32` | Readability |
| 🟢 Low | MCP servers disabled | `agent.ts:80` | Functionality |

---

## Phase 1: Security Hardening (High Priority)

### Task 1.1: Add production webhook secret warning

**File**: `packages/hono-middleware/src/middleware/telegram-auth.ts`

**Current behavior**: If `TELEGRAM_WEBHOOK_SECRET` is not set, auth is silently bypassed.

**Change**: Log a warning when running without secret in production.

```typescript
// Before
if (!secret) {
  return next();
}

// After
if (!secret) {
  // Log warning for production visibility
  console.warn('[SECURITY] TELEGRAM_WEBHOOK_SECRET not configured - webhook auth disabled');
  return next();
}
```

**Acceptance criteria**:
- [ ] Warning logged when secret is not configured
- [ ] Existing behavior unchanged (backward compatible)
- [ ] Add test for warning behavior

---

## Phase 2: Code Cleanup (Medium Priority)

### Task 2.1: Remove unused GitHub MCP server config

**File**: `apps/telegram-bot/src/agent.ts`

**Current state**: Lines 32-39 define `_githubMcpServer` but it's prefixed with `_` and never used.

**Change**: Remove the unused definition or convert to active config with proper timeout handling.

**Decision**: Remove entirely since the comment explains it's disabled due to connection pool issues.

```diff
- /**
-  * GitHub MCP server configuration
-  */
- const _githubMcpServer: MCPServerConnection = {
-   name: 'github-mcp',
-   url: 'https://api.githubcopilot.com/mcp/sse',
-   getAuthHeader: (env) => {
-     const token = env.GITHUB_TOKEN as string | undefined;
-     return token ? `Bearer ${token}` : undefined;
-   },
- };
```

Also remove the `GITHUB_TOKEN` from `BaseEnv` if it's only used for MCP:

**Check**: Verify `GITHUB_TOKEN` usage elsewhere before removing from interface.

**Acceptance criteria**:
- [ ] Unused code removed
- [ ] No type errors after removal
- [ ] Lint passes

### Task 2.2: Extract magic number to constant

**File**: `apps/telegram-bot/src/transport.ts`

**Current state**: Line 32 uses `MAX_MESSAGE_LENGTH / 2` inline.

**Change**: Add named constant for clarity.

```diff
  /** Telegram message length limit */
  const MAX_MESSAGE_LENGTH = 4096;
+ /** Minimum break point threshold (50% of max length) */
+ const MIN_BREAK_THRESHOLD = MAX_MESSAGE_LENGTH / 2;

  function splitMessage(text: string): string[] {
    // ...
-   if (breakPoint === -1 || breakPoint < MAX_MESSAGE_LENGTH / 2) {
+   if (breakPoint === -1 || breakPoint < MIN_BREAK_THRESHOLD) {
      breakPoint = remaining.lastIndexOf(' ', MAX_MESSAGE_LENGTH);
    }
-   if (breakPoint === -1 || breakPoint < MAX_MESSAGE_LENGTH / 2) {
+   if (breakPoint === -1 || breakPoint < MIN_BREAK_THRESHOLD) {
      breakPoint = MAX_MESSAGE_LENGTH;
    }
```

**Acceptance criteria**:
- [ ] Magic number replaced with named constant
- [ ] Existing tests pass
- [ ] Lint passes

---

## Phase 3: Test Coverage (Medium Priority)

### Task 3.1: Add tests for transport.ts

**File**: `apps/telegram-bot/src/__tests__/transport.test.ts`

**Coverage targets**:
- `splitMessage()` - message chunking logic
- `sendTelegramMessage()` - API call with fallback
- `editTelegramMessage()` - edit with truncation
- `sendTypingIndicator()` - typing action
- `telegramTransport` - transport interface implementation
- `createTelegramContext()` - context factory

**Test structure**:

```typescript
describe('transport', () => {
  describe('splitMessage', () => {
    it('returns single chunk for short messages')
    it('splits at newlines when possible')
    it('splits at spaces when no newlines')
    it('hard splits at max length when no break points')
    it('handles empty strings')
    it('handles exactly max length messages')
  });

  describe('sendTelegramMessage', () => {
    it('sends with Markdown parse mode')
    it('falls back to plain text on 400 error')
    it('throws on non-400 errors')
    it('handles multiple chunks')
  });

  describe('editTelegramMessage', () => {
    it('truncates long messages')
    it('falls back to plain text on 400')
    it('does not throw on error (message deleted)')
  });

  describe('sendTypingIndicator', () => {
    it('sends typing action')
    it('consumes response body')
  });

  describe('createTelegramContext', () => {
    it('creates context from webhook data')
    it('includes requestId when provided')
  });
});
```

**Acceptance criteria**:
- [ ] All transport functions have unit tests
- [ ] Mock fetch for API calls
- [ ] >80% line coverage for transport.ts

### Task 3.2: Add tests for authorization.ts

**File**: `apps/telegram-bot/src/__tests__/authorization.test.ts`

**Coverage targets**:
- `parseWebhookRequest()` - JSON parsing and validation
- `isUserAuthorized()` - allowlist logic
- `authorizationMiddleware()` - Hono middleware

**Test structure**:

```typescript
describe('authorization', () => {
  describe('parseWebhookRequest', () => {
    it('returns null for invalid JSON')
    it('returns null for missing message')
    it('returns null for missing text')
    it('returns null for missing from')
    it('extracts message data correctly')
  });

  describe('isUserAuthorized', () => {
    it('allows all when TELEGRAM_ALLOWED_USERS not set')
    it('allows all when TELEGRAM_ALLOWED_USERS is empty')
    it('allows user in allowlist')
    it('rejects user not in allowlist')
    it('handles invalid user IDs in allowlist')
  });

  describe('authorizationMiddleware', () => {
    it('sets skipProcessing for invalid requests')
    it('sets unauthorized flag for rejected users')
    it('sets webhookContext for authorized users')
    it('calls next() in all cases')
  });
});
```

**Acceptance criteria**:
- [ ] All authorization functions tested
- [ ] Mock Hono context for middleware tests
- [ ] >80% line coverage for authorization.ts

---

## Phase 4: Future Improvements (Low Priority)

### Task 4.1: Re-enable MCP servers with timeout handling

**Context**: MCP servers are disabled due to connection pool exhaustion from hanging SSE connections.

**Prerequisites**:
- Implement AbortController support in MCP client
- Add connection timeout to SSE connections
- Add health check/reconnection logic

**Deferred to**: Future sprint when MCP client is enhanced.

---

## Implementation Order

1. **Phase 1.1**: Security warning (30 min)
2. **Phase 2.1**: Remove unused code (15 min)
3. **Phase 2.2**: Extract constant (10 min)
4. **Phase 3.1**: Transport tests (2 hours)
5. **Phase 3.2**: Authorization tests (1.5 hours)

**Total estimated time**: ~4.5 hours

---

## Verification Checklist

After implementation:
- [ ] `bun run check` passes (lint + type-check)
- [ ] `bun run test` passes
- [ ] No new warnings introduced
- [ ] Test coverage improved
- [ ] Security warning visible in logs when secret not set
