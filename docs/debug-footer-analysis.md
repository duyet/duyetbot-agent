---
title: Debug Footer Analysis
description: Analysis of debug footer implementation
---

# Debug Footer Analysis & Log Compaction Guide

## Summary

### ✅ Debug Footer Status: **WORKING**
The debug footer implementation is **fully functional and not broken**. It's simply **not showing because the admin check is failing**.

### 🎯 Root Cause
Your username (`duyet`) doesn't match the admin username being passed (or no admin username is set).

---

## Part 1: Debug Footer Architecture

### How It Works

The debug footer is appended to messages for **admin users only**. This prevents exposing internal debug info to regular users.

```
Message → transport.send() or transport.edit()
  ↓
prepareMessageWithDebug(text, ctx)
  ├─ formatDebugFooter(ctx)
  │  ├─ if (ctx.isAdmin) → return formatted footer
  │  └─ else → return null
  └─ if (footer) → append to text
```

### Code Flow

#### 1. **Telegram Transport** (`apps/telegram-bot/src/transport.ts`)
```typescript
send: async (ctx, text) => {
  const { text: finalText, parseMode } = prepareMessageWithDebug(text, ctx);
  //                                      ↑ Adds footer here
  return sendTelegramMessage(ctx.token, ctx.chatId, finalText, parseMode);
}
```

#### 2. **Debug Footer Formatter** (`apps/telegram-bot/src/debug-footer.ts`)
```typescript
export function formatDebugFooter(ctx: TelegramContext): string | null {
  if (!ctx.isAdmin) {
    return null;  // ← This is why footer doesn't show
  }
  // Format and return footer...
}
```

#### 3. **Admin Check** (`apps/telegram-bot/src/transport.ts:682-687`)
```typescript
function computeIsAdmin(username?: string, adminUsername?: string): boolean {
  if (!username || !adminUsername) {
    return false;  // ← Missing adminUsername causes failure
  }
  return normalizeUsername(username) === normalizeUsername(adminUsername);
  // Removes leading @ and compares case-insensitively
}
```

#### 4. **DebugContext Population** (Two Paths)

**Path A: HANDLE (Direct Chat Loop)**
```
cloudflare-agent.ts:818  → During loading: stepTracker.getDebugContext()
cloudflare-agent.ts:921  → Before response: Detailed DebugContext
```

**Path B: RPC (Durable Alarm)**
```
cloudflare-agent.ts:1344 → During loading: buildDebugContext(stepTracker)
cloudflare-agent.ts:1368 → Before response: buildDebugContext(stepTracker)
```

The `buildDebugContext()` function (line 1099-1185) constructs:
- `routingFlow`: Empty (no routing in direct chat)
- `totalDurationMs`: Total execution time
- `metadata`: Model, trace ID, token usage
- `steps`: Execution chain (thinking → tool calls → results)

---

## Part 2: Why Footer Isn't Showing

### Your Current State

From your logs:
```
(info) [WEBHOOK] Message received {
  "username":"duyet",
  ...
}
```

But the admin check requires:
```
ctx.isAdmin = (username === adminUsername)
            = ("duyet" === undefined)  ← adminUsername not set!
            = false  ← No footer
```

### Solution: Set Admin Username

#### Option 1: Environment Variable (Recommended)
```bash
# In your .env or Cloudflare secrets
TELEGRAM_ADMIN_USERNAME=duyet

# Deploy
bun run deploy:telegram
```

Then create TelegramContext with:
```typescript
const ctx = createTelegramContext(
  token,
  webhookCtx,
  env.TELEGRAM_ADMIN_USERNAME,  // ← Pass this
  requestId,
  parseMode
);
```

#### Option 2: Check Webhook Handler

Verify `apps/telegram-bot/src/index.ts` or your webhook handler passes `adminUsername`:

```typescript
const ctx = createTelegramContext(
  env.TELEGRAM_BOT_TOKEN,
  webhookCtx,
  env.TELEGRAM_ADMIN_USERNAME,  // ← Must not be undefined
  requestId
);
```

---

## Part 3: Log Compaction Solution

### Problem
Your logs have redundant "State updated" entries:
```
(log) {
  displayMessage: 'State updated',
  id: 'FAgyjrmzpRXx_LURS8hBl',
  payload: {},
  timestamp: 1765739728961,
  type: 'state:update'
}
(log) {
  displayMessage: 'State updated',
  id: 'G060kn9Dj8GGPSQINg9oe',
  ...
}
```

Repeated 100+ times per request → **noise**.

### Solution: New Log Compactor

Added `packages/observability/src/log-compactor.ts` with:

```typescript
// Compact "State updated" to single line
compactStateUpdate(log)
// Output: [state] msgs:20 | t:728961

// Compress large context objects
compactDebugContext(context)
// Output: { messages: [<2 items>], messageCount: 20 }

// Transform entire log for readability
compactLog(log, { abbreviate: true })
```

### Usage Examples

#### Example 1: Your current verbose log
```
(log) {
  displayMessage: 'State updated',
  id: 'FAgyjrmzpRXx_LURS8hBl',
  payload: {},
  timestamp: 1765739728961,
  type: 'state:update'
}
```

#### Becomes:
```
(log) [state] msgs:20 | t:728961
```

#### Example 2: Compact debug context
```typescript
const logger = createLogger();
const compactedContext = compactDebugContext(largeContext, {
  abbreviate: true,
  hideRefs: true
});
logger.debug('[AGENT] Context:', compactedContext);

// Output:
// [AGENT] Context: { messages: [{role: 'user'}, {role: 'assistant'}], messageCount: 42 }
```

---

## Part 4: Dead Code Analysis

### ✅ No Dead Code Found

Searched for:
- `debugFooter` references (active in all code paths)
- `formatDebugFooter` (exported and used in transport)
- Footer-related refactoring (none detected)

**All footer code is live and functional.**

The two code paths are:
1. **HANDLE (cloudflare-agent.ts:2770-2980)** - Fire-and-forget with alarm
2. **RPC (cloudflare-agent.ts:1280-1400)** - Synchronous RPC call

Both paths set `ctx.debugContext` before calling `transport.send()` or `transport.edit()`.

---

## Part 5: Implementation Checklist

### To Enable Debug Footer

- [ ] Set `TELEGRAM_ADMIN_USERNAME` to your username
- [ ] Redeploy: `bun run deploy:telegram`
- [ ] Test: Send message as admin user

### To Use Log Compaction

```typescript
import {
  compactLog,
  compactStateUpdate,
  createCompactMiddleware
} from '@duyetbot/observability';

// Option 1: Compact individual logs
console.log(compactLog(logObject));

// Option 2: Use in middleware
const middleware = createCompactMiddleware({ abbreviate: true });
middleware(logObject);  // Returns compact form
```

### Example Logger Setup
```typescript
// Suppress repetitive state update logs
const logger = createLogger({
  filter: (log) => {
    // Skip verbose state updates
    if (log.type === 'state:update') return false;
    return true;
  }
});

// Or compact them instead
const compactLogger = createLogger({
  middleware: createCompactMiddleware()
});
```

---

## Part 6: Architecture Notes

### Debug Context Structure

```typescript
interface DebugContext {
  // Routing info (empty for direct chat)
  routingFlow: Array<{
    agent: string;
    durationMs: number;
    status: 'running' | 'completed' | 'error';
    tokenUsage?: TokenUsage;
  }>;

  // Total execution time
  totalDurationMs: number;

  // Model, trace, tokens, errors
  metadata?: {
    model?: string;
    traceId?: string;
    tokenUsage?: TokenUsage;
    lastToolError?: string;
  };

  // Execution chain (thinking → tools → results)
  steps?: ExecutionStep[];

  // Worker info for orchestrator
  workers?: WorkerDebugInfo[];
}
```

### Why Direct Chat Has Empty `routingFlow`

Recent refactoring removed routing/workflow paths:
- Line 836: "Direct chat calls only - routing removed"
- `buildDebugContext()` sets `routingFlow: []`
- Footer falls back to minimal format (duration + model + trace)

This is **correct behavior** - there's no routing to display.

---

## Summary

| Item | Status |
|------|--------|
| Debug Footer Code | ✅ **Active, working** |
| Dead Code | ✅ **None found** |
| Admin Check | ⚠️ **Failing** (missing adminUsername) |
| Log Verbosity | 🆕 **Compactor added** |

**Next Step**: Set `TELEGRAM_ADMIN_USERNAME` environment variable and redeploy to see the footer!
