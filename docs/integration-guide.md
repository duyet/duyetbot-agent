---
title: Integration Guide
description: How to integrate safety patterns
---

# Integration Guide: How to Use Safety Patterns

Complete walkthrough of integrating log compaction and context validation in your application.

---

## Part 1: Log Compaction Integration

### What We Added

Enhanced logger with built-in compaction to reduce noise from repetitive logs.

**File**: `packages/hono-middleware/src/logger.ts`

### Features

✅ **Compact State Updates**
```
Before: { displayMessage: 'State updated', type: 'state:update', messages: [...], timestamp: 1765739728961 }
After:  [state] msgs:20 | t:728961
```

✅ **Abbreviate Field Names**
```
messages → msgs, timestamp → t, traceId → trace
```

✅ **Hide Sensitive Refs**
```
ID shortcuts: abc123def456 → abc12345...
```

✅ **Filter Support**
```
Skip logs entirely based on custom logic
```

### Usage

#### Global Configuration

Set globally in your app initialization:

```typescript
import { configureLogger } from '@duyetbot/hono-middleware';

// Enable compaction everywhere
configureLogger({
  compact: true,
  abbreviate: true,
  hideRefs: true,
});

// Now all logger calls use compaction
logger.info('message', data);  // ✅ Compacted automatically
```

#### Per-Call Configuration

Override for specific logs:

```typescript
import { logger } from '@duyetbot/hono-middleware';

// With compaction
logger.info('Agent state', stateData, { compact: true, abbreviate: true });

// Without compaction (still works)
logger.info('Important', data, { compact: false });
```

#### Custom Filters

Skip logs matching conditions:

```typescript
configureLogger({
  filter: (level, message, context) => {
    // Skip noisy state updates
    if (context?.type === 'state:update') {
      return false;  // Don't log
    }
    // Log everything else
    return true;
  },
  compact: true,
});
```

### Integration Example: Telegram Bot

**File**: `apps/telegram-bot/src/index.ts` (ready to integrate)

```typescript
// At app startup
import { configureLogger } from '@duyetbot/hono-middleware';

// Enable compaction globally
configureLogger({
  compact: true,
  abbreviate: true,
  hideRefs: false,  // Keep trace IDs for debugging
});

// Now all logger calls are compacted automatically
logger.info('[WEBHOOK] Received', {
  chatId: 123456,
  userId: 789,
  // ... large data structures are automatically compacted
});
```

### Configuration Options

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `compact` | boolean | false | Enable log compaction |
| `abbreviate` | boolean | false | Shorten field names |
| `hideRefs` | boolean | false | Truncate IDs and trace IDs |
| `filter` | function | undefined | Custom filter logic |

---

## Part 2: Context Validation Integration

### What We Added

Strong TypeScript typing + runtime validation for context passing.

**File**: `packages/cloudflare-agent/src/context-validation.ts`

### Core Components

#### 1. Strict Interfaces

```typescript
// All required fields explicit
export interface TelegramContextFull {
  token: string;        // ✅ Required
  chatId: number;       // ✅ Required
  userId: number;       // ✅ Required
  isAdmin: boolean;     // ✅ Required
  text: string;         // ✅ Required
  startTime: number;    // ✅ Required
  messageId: number;    // ✅ Required
  isGroupChat: boolean; // ✅ Required
  // Optional fields...
  username?: string;
  debugContext?: DebugContext;
}

// Admin-only context
export interface AdminTelegramContext extends TelegramContextFull {
  isAdmin: true;
  debugContext: DebugContext;
}
```

#### 2. Runtime Assertions

```typescript
// Throws if any required field missing
assertContextComplete(ctx);

// Throws if not admin or missing debugContext
assertAdminContext(ctx);
```

#### 3. Type Guards

```typescript
// Narrow type for conditional logic
if (isAdminContext(ctx)) {
  // ctx is now AdminTelegramContext
  const footer = formatDebugFooter(ctx.debugContext);
}
```

#### 4. Builder Pattern

```typescript
// Validate incrementally
const ctx = new TelegramContextBuilder()
  .setToken(token)
  .setChatId(chatId)
  .setUserId(userId)
  .setIsAdmin(isAdmin)
  .setText(text)
  .setStartTime(Date.now())
  .setMessageId(messageId)
  .setIsGroupChat(false)
  .build();  // Throws if any required field missing
```

#### 5. Middleware Validation

```typescript
// Guard all handlers
app.use(validateContextMiddleware());
```

### Integration: Telegram Bot

**File**: `apps/telegram-bot/src/index.ts` ✅ Already integrated

```typescript
import { assertContextComplete } from '@duyetbot/cloudflare-agent';

// After creating context
const ctx = createTelegramContext(
  env.TELEGRAM_BOT_TOKEN,
  webhookCtx,
  env.TELEGRAM_ADMIN,
  requestId,
  'MarkdownV2'
);

// ✅ Validate before use
try {
  assertContextComplete(ctx);
} catch (error) {
  logger.error('[VALIDATION] Context incomplete', { error: error.message });
  return c.text('OK');
}

// Now ctx is guaranteed to have all required fields
const footer = formatDebugFooter(ctx);  // Safe!
```

### When to Use Each Approach

| Scenario | Use | Example |
|----------|-----|---------|
| Type safety | Interfaces | All function parameters |
| Boundary validation | assertContextComplete() | After context creation |
| Admin operations | assertAdminContext() | Footer display, debug info |
| Conditional logic | isAdminContext() | Type narrowing in if/else |
| Complex objects | TelegramContextBuilder | When combining data from multiple sources |
| Global guard | validateContextMiddleware() | Wrap all handlers |

---

## Part 3: Combined Usage

### Real-World Example

```typescript
import {
  configureLogger,
  logger,
} from '@duyetbot/hono-middleware';
import {
  assertContextComplete,
  isAdminContext,
} from '@duyetbot/cloudflare-agent';

// 1️⃣ Configure logger at startup
configureLogger({
  compact: true,
  abbreviate: true,
  hideRefs: false,
  filter: (level, message) => {
    // Skip debug logs in production
    if (level === 'debug' && process.env.ENV === 'production') {
      return false;
    }
    return true;
  },
});

// 2️⃣ In webhook handler
app.post('/webhook', async (c) => {
  const ctx = createTelegramContext(
    env.TELEGRAM_BOT_TOKEN,
    webhookCtx,
    env.TELEGRAM_ADMIN,
    requestId
  );

  // 3️⃣ Validate context
  try {
    assertContextComplete(ctx);
  } catch (error) {
    logger.error('[VALIDATION] Failed', { error: error.message });
    return c.text('OK');
  }

  // 4️⃣ Log with automatic compaction
  logger.info('[WEBHOOK] Processing', {
    userId: ctx.userId,
    chatId: ctx.chatId,
    messageLength: ctx.text.length,
    // Large objects automatically compacted
    fullContext: ctx,
  }, { compact: true });

  // 5️⃣ Use type guards for conditional logic
  if (isAdminContext(ctx)) {
    // ctx is AdminTelegramContext - safe to use debugContext
    const debugInfo = formatDebugFooter(ctx.debugContext);
    logger.debug('[ADMIN] Debug info', { footer: debugInfo });
  }

  // Proceed with message handling...
});
```

### Output

```
[WEBHOOK] Processing { userId: 123456, chatId: 789, messageLength: 42, fullContext: <object with 12 keys> }
[ADMIN] Debug info { footer: "[debug] router-agent (0.4s) → simple-agent (3.77s)" }
```

---

## Part 4: Best Practices

### ✅ DO

**Validate at boundaries**
```typescript
// Good: Validate after context creation
const ctx = createContext(...);
assertContextComplete(ctx);  // Throws if incomplete

// Good: Validate incoming data
app.post('/webhook', validateContextMiddleware(), (c) => {
  // ctx is guaranteed valid
});
```

**Use type guards for conditional logic**
```typescript
// Good: Narrow type for safety
if (isAdminContext(ctx)) {
  // ctx is AdminTelegramContext - debugContext exists
}
```

**Enable compaction for noisy logs**
```typescript
// Good: Reduce noise from repetitive logs
configureLogger({ compact: true });
logger.info('State', state);  // Compacted automatically
```

**Filter unnecessary logs**
```typescript
// Good: Skip noisy logs entirely
configureLogger({
  filter: (level, msg) => msg.type !== 'state:update'
});
```

### ❌ DON'T

**Skip validation**
```typescript
// Bad: May crash downstream if fields missing
const ctx = createContext(...);
await transport.send(ctx, message);  // ctx might be incomplete
```

**Use unsafe casts**
```typescript
// Bad: Loses type safety
const ctx = webhookCtx as unknown as TelegramContextFull;
```

**Enable compaction everywhere**
```typescript
// Bad: Might hide important debug info
configureLogger({ compact: true, hideRefs: true });
// Now error logs have truncated trace IDs
```

**Ignore validation errors**
```typescript
// Bad: Silently ignore validation failure
try {
  assertContextComplete(ctx);
} catch (error) {
  // DON'T silently ignore
}
```

---

## Part 5: Migration Checklist

### Phase 1: Enable Log Compaction (Optional)

- [ ] Review `packages/hono-middleware/src/logger.ts` changes
- [ ] Call `configureLogger()` at app startup:
  ```typescript
  configureLogger({ compact: true, abbreviate: true });
  ```
- [ ] Monitor logs in Cloudflare dashboard
- [ ] Adjust filter rules if needed

### Phase 2: Add Context Validation (Recommended)

- [ ] Review `packages/cloudflare-agent/src/context-validation.ts`
- [ ] Import validation functions:
  ```typescript
  import { assertContextComplete } from '@duyetbot/cloudflare-agent';
  ```
- [ ] Add validation after context creation:
  ```typescript
  try {
    assertContextComplete(ctx);
  } catch (error) {
    logger.error('[VALIDATION] Failed', { error: error.message });
    // handle error
  }
  ```
- [ ] Add type guards for conditional logic:
  ```typescript
  if (isAdminContext(ctx)) {
    // Use admin features
  }
  ```
- [ ] Test with invalid contexts to verify errors

### Phase 3: Adopt Middleware Validation (Advanced)

- [ ] Import middleware:
  ```typescript
  import { validateContextMiddleware } from '@duyetbot/cloudflare-agent';
  ```
- [ ] Register globally:
  ```typescript
  app.use(validateContextMiddleware());
  ```
- [ ] All handlers now have validated context
- [ ] Remove per-handler validation (middleware handles it)

---

## Part 6: Testing

### Test Log Compaction

```typescript
import { configureLogger, logger } from '@duyetbot/hono-middleware';

// Enable compaction
configureLogger({ compact: true });

// Test state update compaction
logger.info('test', {
  type: 'state:update',
  displayMessage: 'State updated',
  payload: { messages: new Array(25).fill({}) },
  timestamp: 1765739728961,
});

// Expected output:
// test {"type":"state:update","summary":"[state] msgs:25 | t:728961"}
```

### Test Context Validation

```typescript
import { assertContextComplete } from '@duyetbot/cloudflare-agent';

// Test with incomplete context
const incompletCtx = { token: 'abc' };
try {
  assertContextComplete(incompletCtx);
  throw new Error('Should have thrown');
} catch (error) {
  assert(error.message.includes('missing required fields'));
}

// Test with complete context
const completeCtx = {
  token: 'abc',
  chatId: 123,
  userId: 456,
  isAdmin: false,
  text: 'hello',
  startTime: Date.now(),
  messageId: 1,
  isGroupChat: false,
};
assertContextComplete(completeCtx);  // ✅ No error
```

---

## Part 7: Troubleshooting

### "Context missing required fields"

**Cause**: One or more required fields not set

**Check**:
```typescript
const required = ['token', 'chatId', 'userId', 'isAdmin', 'text', 'startTime', 'messageId', 'isGroupChat'];
for (const field of required) {
  console.log(`${field}: ${ctx[field]}`);
}
```

**Fix**: Ensure all required fields are passed to `createTelegramContext()`

### "isAdmin but missing debugContext"

**Cause**: Admin user without debug context

**Fix**: Ensure debug context is set before logging footer:
```typescript
ctx.debugContext = stepTracker.getDebugContext();
```

### Logs not compacting

**Cause**: Compaction not enabled

**Check**:
```typescript
configureLogger({ compact: true });  // Must call at startup
```

**Verify**:
```typescript
logger.info('test', { type: 'state:update', ... }, { compact: true });  // Force on specific log
```

---

## Summary

✅ **Log Compaction**: 10x smaller logs, especially for repetitive state updates
✅ **Context Validation**: Catch missing fields early with TypeScript + runtime checks
✅ **Integration**: Ready to use in Telegram bot, GitHub bot, or other platforms
✅ **Best Practices**: Follow patterns to prevent silent failures

---

## See Also

- `packages/hono-middleware/src/logger.ts` - Logger implementation with compaction
- `packages/cloudflare-agent/src/context-validation.ts` - Context validation implementation
- `apps/telegram-bot/src/index.ts` - Real-world integration example
- `docs/debug-footer-analysis.md` - Debug footer details
- `docs/context-typing-guide.md` - Detailed context typing guide
