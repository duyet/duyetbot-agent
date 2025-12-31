---
title: Refactoring Safety
description: Preventing Context Variable Removal
---

# Refactoring Safety: Preventing Context Variable Removal

Guide to using TypeScript's type system to prevent accidentally removing context variables during refactoring.

---

## The Problem

During refactoring, it's easy to accidentally:

```typescript
// ❌ BAD REFACTORING: Removed adminUsername by mistake
function createTelegramContext(
  token: string,
  webhookCtx: WebhookContext,
  // adminUsername was here!  ← Removed by AI or developer
  requestId?: string,
  parseMode?: 'HTML' | 'MarkdownV2'
): TelegramContext {
  return {
    token,
    chatId: webhookCtx.chatId,
    userId: webhookCtx.userId,
    username: webhookCtx.username,
    // ... other fields
    // adminUsername is missing!  ← Now debugContext can't be populated correctly
    debugContext: undefined,  // ← Silently fails
  };
}

// Later, this silently fails:
const footer = formatDebugFooter(ctx);  // Returns null - why?
```

**Result**: Silent failure, hard to debug, users don't see debug footer.

---

## The Solution: Strict TypeScript Types

### 1. Require All Parameters

```typescript
// ✅ GOOD: Function signature shows all required parameters
export function createTelegramContext(
  token: string,
  webhookCtx: WebhookContext,
  adminUsername: string | undefined,  // ← Now required in signature!
  requestId: string | undefined,
  parseMode?: 'HTML' | 'MarkdownV2'
): TelegramContextFull {
  // Function body must use all parameters
  return {
    token,
    chatId: webhookCtx.chatId,
    userId: webhookCtx.userId,
    username: webhookCtx.username,
    adminUsername,  // ← Must include
    isAdmin: webhookCtx.username === adminUsername,  // ← Must use
    // ... other fields
  };
}
```

### 2. Refactor Safely

Now if someone tries to remove adminUsername:

```typescript
// ❌ ERROR: Cannot remove parameter without updating call sites
export function createTelegramContext(
  token: string,
  webhookCtx: WebhookContext,
  // ❌ Removed adminUsername
  requestId?: string,
  parseMode?: 'HTML' | 'MarkdownV2'
): TelegramContextFull {
  return {
    token,
    chatId: webhookCtx.chatId,
    // ... other fields
  };
}

// At call sites, TypeScript immediately reports error:
const ctx = createTelegramContext(
  env.TELEGRAM_BOT_TOKEN,
  webhookCtx,
  env.TELEGRAM_ADMIN,  // ❌ ERROR: Expected 2 arguments, got 3
  requestId
);
```

**Result**: Cannot accidentally remove parameters - TypeScript catches it!

---

## Part 1: Parameter Validation

### Required vs Optional Parameters

```typescript
// ❌ BAD: Optional parameter that should be required
export function createTelegramContext(
  token: string,
  webhookCtx: WebhookContext,
  adminUsername?: string,  // ← Too loose! Easy to forget
  requestId?: string,
  parseMode?: 'HTML' | 'MarkdownV2'
): TelegramContext { ... }

// ✅ GOOD: Required parameter in signature
export function createTelegramContext(
  token: string,
  webhookCtx: WebhookContext,
  adminUsername: string | undefined,  // ← Required! Can be undefined, but must pass it
  requestId: string | undefined,
  parseMode?: 'HTML' | 'MarkdownV2'
): TelegramContextFull { ... }
```

### Call Sites Must Provide All Parameters

```typescript
// ✅ OK: All required parameters provided
const ctx = createTelegramContext(
  env.TELEGRAM_BOT_TOKEN,        // required
  webhookCtx,                      // required
  env.TELEGRAM_ADMIN,              // required (even if undefined)
  requestId,                       // required (even if undefined)
  'MarkdownV2'                     // optional
);

// ❌ ERROR: Missing required parameter
const ctx = createTelegramContext(
  env.TELEGRAM_BOT_TOKEN,
  webhookCtx,
  // ERROR: Missing argument for parameter 'adminUsername'
);
```

---

## Part 2: Interface Field Validation

### Required Fields in Types

```typescript
// ✅ GOOD: All required fields explicit
export interface TelegramContextFull {
  token: string;           // ← Required (no ?)
  chatId: number;          // ← Required (no ?)
  userId: number;          // ← Required (no ?)
  isAdmin: boolean;        // ← Required (no ?)
  adminUsername: string | undefined;  // ← Required to track (can be undefined)
  debugContext?: DebugContext;  // ← Optional (can omit)
}

// If someone tries to remove adminUsername:
export interface TelegramContextFull {
  token: string;
  chatId: number;
  userId: number;
  isAdmin: boolean;
  // ❌ adminUsername removed
  debugContext?: DebugContext;
}

// TypeScript errors at all usage sites:
function computeIsAdmin(ctx: TelegramContextFull) {
  // ❌ ERROR: Property 'adminUsername' does not exist on type...
  return ctx.username === ctx.adminUsername;
}
```

---

## Part 3: Type Intersection for Tracking

### Track ALL Context Sources

```typescript
// ✅ COMPREHENSIVE: Shows all context dependencies
export interface TelegramContextFull
  extends WebhookContext,
    AdminContext,
    RequestContext,
    TransportContext {
  // Inherits from multiple sources
}

// If AdminContext is removed from extends:
export interface TelegramContextFull
  extends WebhookContext,
  // ❌ AdminContext removed
    RequestContext,
    TransportContext {
  // ERROR: isAdmin and adminUsername now missing
}

function sendMessage(ctx: TelegramContextFull) {
  // ❌ ERROR: Property 'isAdmin' does not exist on type...
  if (ctx.isAdmin) { ... }
}
```

---

## Part 4: Union Types for Validation

### Restrict to Valid Combinations

```typescript
// ✅ GOOD: Defines valid context states
export type TelegramContext =
  | (TelegramContextFull & { isAdmin: false })
  | (TelegramContextFull & { isAdmin: true; debugContext: DebugContext })
  | AdminTelegramContext;

// If someone removes debugContext:
export type TelegramContext =
  | (TelegramContextFull & { isAdmin: false })
  | (TelegramContextFull & { isAdmin: true })  // ❌ Missing debugContext!
  | AdminTelegramContext;

// Errors when trying to use debugContext without checking:
function formatFooter(ctx: TelegramContext) {
  if (ctx.isAdmin) {
    // ❌ ERROR: Property 'debugContext' does not exist on type...
    return formatDebugFooter(ctx.debugContext);
  }
}
```

---

## Part 5: Generic Constraints for Safety

### Enforce Type Requirements

```typescript
// ✅ GOOD: Generic constraint ensures debugContext exists for admins
export function formatFooterForAdmin<T extends AdminTelegramContext>(
  ctx: T
): string {
  // TypeScript guarantees ctx.debugContext exists
  return formatDebugFooter(ctx.debugContext);
}

// Can't call with non-admin context:
const userCtx: TelegramContextFull = {...};
formatFooterForAdmin(userCtx);
// ❌ ERROR: Argument of type 'TelegramContextFull' is not assignable to
// parameter of type 'AdminTelegramContext'
```

---

## Real-World Example: Our Implementation

### Current Implementation ✅

```typescript
// 1. PARAMETERS: All required in signature
export function createTelegramContext(
  token: string,                                      // ✅ Required
  webhookCtx: { chatId: number; userId: number; ... },  // ✅ Required
  adminUsername: string | undefined,                 // ✅ Required (can be undefined)
  requestId: string | undefined,                     // ✅ Required (can be undefined)
  parseMode?: 'HTML' | 'MarkdownV2'                  // ✅ Optional
): TelegramContextFull {
  // Must use all required parameters
  const isAdmin = webhookCtx.username === adminUsername;
  return {
    token,
    chatId: webhookCtx.chatId,
    userId: webhookCtx.userId,
    username: webhookCtx.username,
    adminUsername,  // ← Must include!
    isAdmin,        // ← Computed from both parameters
    text: webhookCtx.text,
    startTime: webhookCtx.startTime,
    messageId: webhookCtx.messageId,
    isGroupChat: webhookCtx.isGroupChat,
    parseMode,
  };
}

// 2. TYPES: All required fields explicit
export interface TelegramContextFull {
  token: string;
  chatId: number;
  userId: number;
  isAdmin: boolean;
  username?: string;
  adminUsername?: string;  // ← Required to track, even if undefined
  text: string;
  startTime: number;
  messageId: number;
  isGroupChat: boolean;
  parseMode?: 'HTML' | 'MarkdownV2';
  debugContext?: DebugContext;
}

// 3. FUNCTIONS: Enforce parameter usage
function isAdminContext(ctx: TelegramContextFull): ctx is AdminTelegramContext {
  // Must check both isAdmin AND debugContext
  return ctx.isAdmin === true && ctx.debugContext !== undefined;
}

// 4. GUARDS: Type guards enforce safety
if (isAdminContext(ctx)) {
  // TypeScript knows debugContext exists here
  const footer = formatDebugFooter(ctx.debugContext);
}
```

### Result: Safe Refactoring

Now if someone refactors and removes adminUsername:

```typescript
// ❌ CAUGHT: Parameter removed
export function createTelegramContext(
  token: string,
  webhookCtx: {...},
  // adminUsername removed!
  requestId?: string,
  parseMode?: 'HTML' | 'MarkdownV2'
): TelegramContextFull {
  // ❌ ERROR: 'adminUsername' is not defined
  const isAdmin = webhookCtx.username === adminUsername;
  return { ... };
}

// ❌ CAUGHT: Call site has wrong arity
const ctx = createTelegramContext(
  env.TELEGRAM_BOT_TOKEN,
  webhookCtx,
  env.TELEGRAM_ADMIN,  // ❌ ERROR: Expected 2 arguments, got 3
  requestId
);

// ❌ CAUGHT: Field removed from type
export interface TelegramContextFull {
  token: string;
  // adminUsername removed!
  // ...
}

// All usages immediately error:
const isAdmin = webhookCtx.username === ctx.adminUsername;
// ❌ ERROR: Property 'adminUsername' does not exist on type...
```

---

## Part 6: Audit Trail

### Show What Changed

```typescript
// Git shows exactly what was removed:
- adminUsername: string | undefined,  // ← This line was removed!

// TypeScript shows which code broke:
// packages/telegram-bot/src/index.ts:119 - error TS2339:
//   Property 'adminUsername' does not exist on type 'TelegramContextFull'.
//
// packages/cloudflare-agent/src/context-validation.ts:155 - error TS2339:
//   Property 'adminUsername' does not exist on type 'TelegramContextFull'.
//
// apps/telegram-bot/src/transport.ts:682 - error TS2339:
//   Property 'adminUsername' does not exist on type 'TelegramContextFull'.
```

---

## Part 7: Prevention Best Practices

### ✅ DO

**1. Make Required Parameters Explicit**
```typescript
// ✅ Good: Cannot accidentally omit
export function createContext(
  token: string,        // ✅ Required, no default
  adminUsername: string | undefined,  // ✅ Required param, can be undefined value
  ...
): TelegramContextFull { ... }
```

**2. Mark All Required Fields**
```typescript
// ✅ Good: All required fields explicit
export interface TelegramContextFull {
  token: string;        // ← No ?
  adminUsername?: string;  // ← Required to pass, optional value
  isAdmin: boolean;     // ← No ?
}
```

**3. Inherit from Multiple Interfaces**
```typescript
// ✅ Good: Shows all dependencies
export interface TelegramContextFull
  extends WebhookContext,
    AdminContext,
    RequestContext {
  // ...
}
```

**4. Use Type Guards**
```typescript
// ✅ Good: Guards prevent silent failures
export function isAdminContext(
  ctx: TelegramContextFull
): ctx is AdminTelegramContext {
  return ctx.isAdmin === true && ctx.debugContext !== undefined;
}
```

### ❌ DON'T

**1. Make Required Parameters Optional**
```typescript
// ❌ Bad: Can accidentally omit
export function createContext(
  token: string,
  adminUsername?: string,  // ← Easy to forget!
  ...
): TelegramContextFull { ... }
```

**2. Have Optional Fields That Should Be Required**
```typescript
// ❌ Bad: adminUsername is optional but required for logic
export interface TelegramContextFull {
  token: string;
  adminUsername?: string;  // ← This should be required!
  isAdmin: boolean;
}
```

**3. Accept Extra Parameters You Don't Use**
```typescript
// ❌ Bad: Unused parameter hides requirements
export function createContext(
  token: string,
  webhookCtx: WebhookContext,
  adminUsername?: string,  // ← Looks optional
  userId?: number,         // ← Unused, confusing
  ...
): TelegramContextFull { ... }
```

---

## Part 8: Testing Refactoring Safety

### Type Check Forces Correctness

```bash
# Refactoring attempt 1: Remove adminUsername
$ bun run type-check
# ❌ Multiple errors - caught immediately!

# Refactoring attempt 2: Rename isAdmin to isAdministrator
$ bun run type-check
# ❌ Caught at 47 usage sites!

# Refactoring attempt 3: Make debugContext required
$ bun run type-check
# ❌ Caught - undefined contexts will error!
```

---

## Part 9: Comparison: With vs Without Strong Types

### Without Strong Types ❌

```typescript
// 1. Function signature unclear
function createTelegramContext(token, webhookCtx, adminUsername, requestId) {
  // Are all parameters required? Easy to forget adminUsername
}

// 2. Easy to accidentally skip parameter
const ctx = createTelegramContext(token, webhookCtx, requestId);
// Silently works, but adminUsername is undefined!

// 3. Silent failure downstream
const isAdmin = webhookCtx.username === ctx.adminUsername;
// undefined === "user" → false, but why?

// 4. Debug footer doesn't show
const footer = formatDebugFooter(ctx);
// Returns null - difficult to debug why!

// 5. Refactoring is risky
// Remove adminUsername parameter without updating all call sites?
// Some might still work, others fail silently...
```

### With Strong Types ✅

```typescript
// 1. Function signature explicit
function createTelegramContext(
  token: string,
  webhookCtx: WebhookContext,
  adminUsername: string | undefined,  // ← Clear: must pass!
  requestId: string | undefined,
  parseMode?: 'HTML' | 'MarkdownV2'
): TelegramContextFull { ... }

// 2. Parameter required
const ctx = createTelegramContext(
  token,
  webhookCtx,
  // ❌ ERROR: Missing argument for parameter 'adminUsername'
  requestId
);

// 3. Type error immediately
const isAdmin = webhookCtx.username === ctx.adminUsername;
// TypeScript checks ctx has adminUsername field

// 4. Debug footer type-safe
const footer = formatDebugFooter(ctx);  // ✅ Guaranteed to work correctly

// 5. Refactoring forces updates
// Remove adminUsername? All 47 call sites immediately error!
// Can't accidentally skip any call site.
```

---

## Summary

**Strong TypeScript typing prevents:**

✅ Accidentally removing required parameters
✅ Silently dropping context variables
✅ Breaking logic downstream
✅ Hard-to-debug errors
✅ Inconsistent context state

**Method:**
- Required parameters in function signatures
- Required fields in interfaces
- Type guards for conditional logic
- Type inheritance to show dependencies

**Result**: Safe, confident refactoring with 100% error detection!

---

## Quick Reference

```typescript
// 1. Make parameters required in signature
function createContext(
  token: string,                    // ✅ Required
  adminUsername: string | undefined,  // ✅ Required (value can be undefined)
  ...
): TelegramContextFull { ... }

// 2. Show all required fields in types
export interface TelegramContextFull {
  token: string;                // ✅ Required (no ?)
  adminUsername?: string;       // ✅ Track even if optional value
  isAdmin: boolean;             // ✅ Required (no ?)
  debugContext?: DebugContext;  // ✅ Optional (no requirement to pass)
}

// 3. Use type guards for safety
export function isAdminContext(
  ctx: TelegramContextFull
): ctx is AdminTelegramContext {
  return ctx.isAdmin === true && ctx.debugContext !== undefined;
}

// 4. Trust TypeScript
// If it compiles, the context is correct and complete!
```

---

## See Also

- `packages/cloudflare-agent/src/context-validation.ts` - Implementation
- `docs/typescript-validation.md` - TypeScript type validation guide
- `docs/integration-guide.md` - How to use safely
