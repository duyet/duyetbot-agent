---
title: Context Typing Guide
description: Approaches for validation
---

# Context Passing & Strong Typing Guide

**Problem**: Ensuring all required context is passed through the call chain without missing fields, type-safe.

**Solution**: Multi-layered validation using TypeScript and runtime checks.

---

## Current Issue: Weak Context Typing

### Problem Code

```typescript
// ❌ Weak typing allows missing fields
const ctx = ctx as unknown as { debugContext?: unknown };
ctxWithDebug.debugContext = stepTracker.getDebugContext();

// Issues:
// 1. Cast to unknown loses type safety
// 2. debugContext is optional - might be undefined
// 3. TelegramContext might be missing adminUsername or isAdmin
// 4. No validation that context has all required fields
```

### Risk: Silent Failures

```typescript
// This compiles but fails at runtime
const footer = formatDebugFooter(ctx);  // Uses ctx.isAdmin
// If ctx.isAdmin is undefined → footer is null even though debugContext exists
```

---

## Solution 1: Strict Interface Definition

### Define Complete Context Types

```typescript
// ✅ Strong typing with required fields
export interface TelegramContextFull extends TelegramContext {
  /** Explicitly required for footer operations */
  isAdmin: boolean;  // NOT optional
  /** Debug context required for admin display */
  debugContext?: DebugContext;
  /** Required for messaging */
  token: string;
  chatId: number;
}

// For operations that require admin context
export interface AdminTelegramContext extends TelegramContextFull {
  isAdmin: true;  // Narrowed to true
  debugContext: DebugContext;  // Required if admin
}
```

### Type-Safe Footer Formatting

```typescript
// ✅ Type guards ensure context is complete
export function formatDebugFooterSafe(
  ctx: TelegramContextFull
): string | null {
  if (!ctx.isAdmin) {
    return null;
  }

  // At this point, TypeScript knows ctx.isAdmin is true
  // But debugContext is still optional - handle it
  return coreFormatDebugFooter(ctx.debugContext);
}

// For admin-only operations, require AdminTelegramContext
export function sendAdminFooter(
  ctx: AdminTelegramContext,  // ← Requires isAdmin=true and debugContext
  text: string
): Promise<void> {
  const footer = coreFormatDebugFooter(ctx.debugContext);  // Now always defined
  return transport.send(ctx, text + footer);
}
```

---

## Solution 2: Runtime Validation

### Validate Context at Boundaries

```typescript
// ✅ Assert context completeness
export function assertAdminContext(
  ctx: TelegramContext
): asserts ctx is AdminTelegramContext {
  if (!ctx.isAdmin) {
    throw new Error('Context is not admin - cannot display debug footer');
  }
  if (!ctx.debugContext) {
    throw new Error('Context missing debugContext - required for footer');
  }
  if (!ctx.token || !ctx.chatId) {
    throw new Error('Context missing messaging fields (token, chatId)');
  }
}

// Usage
function sendResponse(ctx: TelegramContext, response: string) {
  assertAdminContext(ctx);  // Assert fails or narrows type

  // Now ctx is AdminTelegramContext - fully typed
  const footer = formatDebugFooter(ctx.debugContext);
  transport.send(ctx, response + footer);
}
```

### Validate via Builder Pattern

```typescript
// ✅ Build context incrementally with validation
export class TelegramContextBuilder {
  private ctx: Partial<TelegramContext> = {};

  setToken(token: string): this {
    if (!token) throw new Error('Token is required');
    this.ctx.token = token;
    return this;
  }

  setAdminUsername(adminUsername: string): this {
    this.ctx.adminUsername = adminUsername;
    return this;
  }

  setDebugContext(debugContext?: DebugContext): this {
    this.ctx.debugContext = debugContext;
    return this;
  }

  // Build and validate
  build(): TelegramContextFull {
    const required = ['token', 'chatId', 'userId', 'isAdmin'] as const;
    for (const field of required) {
      if (!(field in this.ctx) || this.ctx[field] === undefined) {
        throw new Error(`Context missing required field: ${field}`);
      }
    }
    return this.ctx as TelegramContextFull;
  }
}

// Usage
const ctx = new TelegramContextBuilder()
  .setToken(env.TELEGRAM_BOT_TOKEN)
  .setAdminUsername(env.TELEGRAM_ADMIN_USERNAME)
  .setDebugContext(debugContext)
  .build();  // Throws if any field missing
```

---

## Solution 3: Type-Safe Context Chain

### Pipe Context Through Call Stack

```typescript
// ✅ Function overloads ensure context completeness
export async function sendResponse(
  ctx: AdminTelegramContext,  // Admin required
  response: string
): Promise<number>;

export async function sendResponse(
  ctx: TelegramContextFull,  // All required fields
  response: string
): Promise<number>;

export async function sendResponse(
  ctx: TelegramContext,  // Base type
  response: string
): Promise<number> {
  // Runtime validation
  if (!ctx.token || !ctx.chatId) {
    throw new Error('Context missing required messaging fields');
  }

  // Conditional footer based on admin status
  const footer = ctx.isAdmin && ctx.debugContext
    ? formatDebugFooter(ctx.debugContext)
    : null;

  const finalText = footer ? response + footer : response;
  return sendTelegramMessage(ctx.token, ctx.chatId, finalText);
}
```

### Middleware Validates Context

```typescript
// ✅ Middleware ensures context completeness before handlers
export function validateContextMiddleware() {
  return async (ctx: TelegramContext, next: () => Promise<void>) => {
    // Check required fields
    if (!ctx.token) {
      throw new Error('[CTX] Missing token');
    }
    if (ctx.isAdmin === undefined) {
      throw new Error('[CTX] Missing isAdmin - must be boolean');
    }

    // Optional: check admin fields if isAdmin=true
    if (ctx.isAdmin) {
      if (!ctx.adminUsername) {
        logger.warn('[CTX] Admin flag set but adminUsername missing');
      }
      if (!ctx.debugContext) {
        logger.warn('[CTX] Admin user but debugContext missing');
      }
    }

    await next();
  };
}

// Usage
app.use(validateContextMiddleware());  // Ensures all handlers get valid context
```

---

## Solution 4: Prevent Context Loss

### Context Passing in Call Chain

Problem:
```typescript
// ❌ Context might get lost or modified
function handleMessage(ctx: TelegramContext) {
  // Pass ctx to transport
  transport.send(ctx, message);

  // Later in code, ctx might be missing fields
  const footer = formatDebugFooter(ctx);  // ctx.debugContext might be undefined
}
```

Solution:
```typescript
// ✅ Use explicit context manager
export class ContextManager {
  private contexts = new Map<string, TelegramContextFull>();

  // Store context with ID
  store(id: string, ctx: TelegramContextFull): void {
    if (!this.isComplete(ctx)) {
      throw new Error(`[CTX] Incomplete context cannot be stored: ${JSON.stringify(ctx)}`);
    }
    this.contexts.set(id, ctx);
  }

  // Retrieve context
  get(id: string): TelegramContextFull {
    const ctx = this.contexts.get(id);
    if (!ctx) {
      throw new Error(`[CTX] Context not found: ${id}`);
    }
    return ctx;
  }

  // Validate context completeness
  private isComplete(ctx: Partial<TelegramContextFull>): ctx is TelegramContextFull {
    const required = ['token', 'chatId', 'userId', 'isAdmin'] as const;
    return required.every(field => field in ctx && ctx[field] !== undefined);
  }

  // Update context fields (immutably)
  update(id: string, updates: Partial<TelegramContext>): TelegramContextFull {
    const current = this.get(id);
    const updated = { ...current, ...updates };
    if (!this.isComplete(updated)) {
      throw new Error('[CTX] Update would create incomplete context');
    }
    this.contexts.set(id, updated);
    return updated;
  }
}

// Usage
const contextMgr = new ContextManager();

// Store context at start
contextMgr.store(requestId, {
  token,
  chatId,
  userId,
  isAdmin: computeIsAdmin(username, adminUsername),
  // ... all required fields
});

// Later, retrieve and use
const ctx = contextMgr.get(requestId);
const footer = formatDebugFooter(ctx);  // Safe - ctx is complete
```

---

## Solution 5: Type Guards & Narrowing

### Use TypeScript Type Guards

```typescript
// ✅ Type guard for admin context
function isAdminContext(ctx: TelegramContext): ctx is AdminTelegramContext {
  return ctx.isAdmin === true && ctx.debugContext !== undefined;
}

// Type guard for messaging context
function hasMessagingFields(ctx: TelegramContext): ctx is TelegramContextFull {
  return typeof ctx.token === 'string' && typeof ctx.chatId === 'number';
}

// Usage with type narrowing
function sendWithFooter(ctx: TelegramContext, text: string) {
  if (isAdminContext(ctx)) {
    // TypeScript now knows ctx is AdminTelegramContext
    const footer = formatDebugFooter(ctx.debugContext);  // Safe - always defined
    return transport.send(ctx, text + footer);
  }

  // Non-admin path
  return transport.send(ctx, text);
}
```

---

## Implementation: Complete Example

### Full Type-Safe Flow

```typescript
// 1. Define strict types
export interface TelegramContextFull extends TelegramContext {
  isAdmin: boolean;  // Required
  token: string;     // Required
  chatId: number;    // Required
}

export interface AdminTelegramContext extends TelegramContextFull {
  isAdmin: true;
  debugContext: DebugContext;
}

// 2. Create context with validation
function createContextSafe(data: Partial<TelegramContext>): TelegramContextFull {
  const required = {
    token: data.token,
    chatId: data.chatId,
    userId: data.userId,
    isAdmin: data.isAdmin,
    username: data.username,
    text: data.text,
    startTime: data.startTime,
    messageId: data.messageId,
    isGroupChat: data.isGroupChat,
  };

  // Check all required fields
  for (const [key, value] of Object.entries(required)) {
    if (value === undefined) {
      throw new Error(`[CTX] Missing required field: ${key}`);
    }
  }

  return {
    ...data,
    ...required,
    parseMode: data.parseMode || 'HTML',
  } as TelegramContextFull;
}

// 3. Type-safe footer logic
function getFooterSafe(ctx: TelegramContextFull): string | null {
  // Check admin status
  if (!ctx.isAdmin) {
    return null;
  }

  // If admin but no debugContext, warn
  if (!ctx.debugContext) {
    logger.warn('[CTX] Admin user but missing debugContext');
    return null;
  }

  // Safe to format footer
  return formatDebugFooter(ctx.debugContext);
}

// 4. Complete send flow
async function sendResponseSafe(
  ctx: TelegramContextFull,
  response: string,
  debugContext?: DebugContext
): Promise<number> {
  // Update context with debug info
  const ctxWithDebug = { ...ctx, debugContext };

  // Get footer (type-safe)
  const footer = getFooterSafe(ctxWithDebug as TelegramContextFull);

  // Send final message
  const finalText = footer ? response + footer : response;
  return sendTelegramMessage(ctx.token, ctx.chatId, finalText);
}
```

---

## Migration Plan

### Phase 1: Add Type Definitions (Week 1)
- [ ] Define `TelegramContextFull` interface
- [ ] Define `AdminTelegramContext` interface
- [ ] Add type guards (`isAdminContext`, `hasMessagingFields`)

### Phase 2: Add Validation (Week 2)
- [ ] Add `assertAdminContext()` assertions
- [ ] Add `TelegramContextBuilder` for context creation
- [ ] Validate at context creation points

### Phase 3: Update Code (Week 3)
- [ ] Update `createTelegramContext()` to use builder
- [ ] Update footer logic to use type guards
- [ ] Update transport layer to validate context

### Phase 4: Add Middleware (Week 4)
- [ ] Add context validation middleware
- [ ] Add context manager for tracking
- [ ] Add logging for context violations

---

## Summary Table

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| Strict Interfaces | Type-safe, IDE support | Verbose | Baseline all changes |
| Runtime Validation | Catches runtime errors | Performance cost | Boundary layers |
| Type Guards | TypeScript narrowing | Manual checks | Conditional logic |
| Builder Pattern | Clear intent, validates incrementally | Boilerplate | Complex objects |
| Context Manager | Prevents loss, tracks context | Adds indirection | Multi-step flows |

**Recommendation**: Use **Strict Interfaces + Runtime Validation** as foundation, add **Type Guards** for conditional logic.

---

## Quick Implementation Checklist

```typescript
// 1. Add to types.ts
export interface TelegramContextFull extends TelegramContext {
  isAdmin: boolean;
  token: string;
  chatId: number;
}

// 2. Add validation function
export function assertContextComplete(
  ctx: TelegramContext
): asserts ctx is TelegramContextFull {
  if (!ctx.token) throw new Error('Missing token');
  if (ctx.isAdmin === undefined) throw new Error('Missing isAdmin');
}

// 3. Use in critical paths
function handleMessage(ctx: TelegramContext) {
  assertContextComplete(ctx);  // Throws if incomplete

  // Now ctx is TelegramContextFull - safe to use
  const footer = formatDebugFooter(ctx);
}
```

---

## See Also

- `packages/cloudflare-agent/src/types.ts` - Current type definitions
- `apps/telegram-bot/src/transport.ts` - Context creation and usage
- `docs/debug-footer-analysis.md` - Context flow in debug footer
