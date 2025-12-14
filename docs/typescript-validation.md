# TypeScript Type Validation: Compile-Time Safety

Complete guide to using TypeScript's type system to validate context and prevent errors at compile-time.

---

## Overview

TypeScript provides several mechanisms to validate types **at compile time** before any code runs:

1. **Strict Interfaces** - Define what fields MUST exist
2. **Union Types** - Restrict values to known options
3. **Literal Types** - Enforce exact values
4. **Readonly** - Prevent accidental mutations
5. **Generics** - Validate at function boundaries
6. **Conditional Types** - Advanced type logic

---

## Part 1: Strict Interfaces

### Require All Fields

```typescript
// ✅ GOOD: All fields required
export interface TelegramContextFull {
  token: string;        // Required string
  chatId: number;       // Required number
  userId: number;       // Required number
  isAdmin: boolean;     // Required boolean
  text: string;         // Required string
  startTime: number;    // Required number
  messageId: number;    // Required number
  isGroupChat: boolean; // Required boolean
  username?: string;    // Optional string
  debugContext?: DebugContext;  // Optional DebugContext
}
```

### TypeScript Validation

```typescript
// ❌ ERROR: Missing required fields
const ctx: TelegramContextFull = {
  token: 'abc',
  // ERROR: Property 'chatId' is missing in type...
};

// ✅ OK: All required fields present
const ctx: TelegramContextFull = {
  token: 'abc',
  chatId: 123,
  userId: 456,
  isAdmin: false,
  text: 'hello',
  startTime: Date.now(),
  messageId: 1,
  isGroupChat: false,
};
```

### Catch Errors at Compile Time

```bash
$ bun run type-check
packages/telegram-bot/src/transport.ts:45:3 - error TS2345:
  Argument of type '{ token: string; }' is not assignable to
  parameter of type 'TelegramContextFull'.
  Property 'chatId' is missing.
```

---

## Part 2: Optional vs Required

### Distinguish Between Optional and Required

```typescript
// ❌ WRONG: Optional fields that should be required
export interface BadContext {
  token?: string;       // May be undefined - too loose!
  chatId?: number;      // May be undefined - too loose!
  isAdmin?: boolean;    // May be undefined - too loose!
}

// ✅ RIGHT: Required where needed, optional where appropriate
export interface GoodContext {
  // Always required
  token: string;
  chatId: number;
  isAdmin: boolean;

  // Optional - admin might not have debug context
  debugContext?: DebugContext;
}
```

### TypeScript Catches Undefined Errors

```typescript
function processContext(ctx: TelegramContextFull) {
  // ✅ OK: token is required, so it always exists
  const length = ctx.token.length;

  // ❌ ERROR: debugContext is optional, might be undefined
  const footer = formatDebugFooter(ctx.debugContext);
  // Type 'DebugContext | undefined' is not assignable to...

  // ✅ OK: Check before using
  if (ctx.debugContext) {
    const footer = formatDebugFooter(ctx.debugContext);
  }
}
```

---

## Part 3: Type Narrowing with Guards

### Create Type Guards

```typescript
// Type guard that narrows type
function isAdminContext(ctx: TelegramContextFull): ctx is AdminTelegramContext {
  return ctx.isAdmin === true && ctx.debugContext !== undefined;
}

// TypeScript interface for narrowed type
export interface AdminTelegramContext extends TelegramContextFull {
  isAdmin: true;        // Narrowed from boolean to true
  debugContext: DebugContext;  // No longer optional
}
```

### TypeScript Validates Type Narrowing

```typescript
function processContext(ctx: TelegramContextFull) {
  // Before guard: ctx.isAdmin is boolean, ctx.debugContext is optional
  if (ctx.isAdmin) {
    // ❌ ERROR: Still can't use debugContext - it might be undefined
    const footer = formatDebugFooter(ctx.debugContext);
    // Type 'DebugContext | undefined' is not assignable...
  }

  // With type guard: ctx is narrowed
  if (isAdminContext(ctx)) {
    // ✅ OK: TypeScript knows ctx.isAdmin is true and debugContext exists
    const footer = formatDebugFooter(ctx.debugContext);  // No error!
  }
}
```

### How It Works

```typescript
// 1. Function signature promises type narrowing
function isAdminContext(ctx: TelegramContextFull): ctx is AdminTelegramContext {
  //                                               ^^^^
  //                                      This "is" means type guard

  // 2. Return type bool, but also narrows if true
  return ctx.isAdmin === true && ctx.debugContext !== undefined;
}

// 3. Inside if block after guard
if (isAdminContext(ctx)) {
  // ctx is now AdminTelegramContext instead of TelegramContextFull
  // TypeScript knows debugContext exists (not optional)
}
```

---

## Part 4: Union Types for Validation

### Restrict to Known Values

```typescript
// ❌ LOOSE: Any string allowed
export interface LooseContext {
  parseMode: string;  // Could be "XML", "PDF", anything!
}

// ✅ STRICT: Only specific values allowed
export interface StrictContext {
  parseMode: 'HTML' | 'MarkdownV2';  // Only these two
}
```

### TypeScript Catches Invalid Values

```typescript
const ctx: StrictContext = {
  parseMode: 'HTML',  // ✅ OK
};

const ctx2: StrictContext = {
  parseMode: 'XML',   // ❌ ERROR: "XML" is not assignable to...
};

// Catch at compile time, not runtime!
```

### Use with Readonly for Constants

```typescript
// ✅ Define allowed values as readonly
export const PARSE_MODES = ['HTML', 'MarkdownV2'] as const;
//                                                 ^^^^
//                                            as const is key!

export type ParseMode = typeof PARSE_MODES[number];
// Type: 'HTML' | 'MarkdownV2'

// Now TypeScript validates against these exact values
export interface Context {
  parseMode: ParseMode;
}
```

---

## Part 5: Readonly for Immutability

### Prevent Accidental Mutations

```typescript
// ❌ MUTABLE: Can be modified
export interface MutableContext {
  token: string;
  config: { maxRetries: number };
}

const ctx: MutableContext = { token: 'abc', config: { maxRetries: 3 } };
ctx.config.maxRetries = 99;  // ✅ Allowed but maybe unintended!

// ✅ IMMUTABLE: Cannot be modified
export interface ImmutableContext {
  readonly token: string;
  readonly config: { readonly maxRetries: number };
}

const ctx: ImmutableContext = { token: 'abc', config: { maxRetries: 3 } };
ctx.config.maxRetries = 99;  // ❌ ERROR: Cannot assign to readonly property
```

---

## Part 6: Generics for Reusable Validation

### Generic Type Parameters

```typescript
// ✅ REUSABLE: Works for any message type
export interface Transport<T> {
  send(ctx: T, text: string): Promise<number>;
  edit(ctx: T, ref: number, text: string): Promise<void>;
}

export interface TelegramTransport extends Transport<TelegramContextFull> {
  // Specific implementation for Telegram
}

export interface GitHubTransport extends Transport<GitHubContextFull> {
  // Specific implementation for GitHub
}
```

### TypeScript Validates Generic Usage

```typescript
// ✅ OK: Provides correct context type
const telegramTransport: Transport<TelegramContextFull> = {
  send: async (ctx: TelegramContextFull, text: string) => {
    // ctx is guaranteed to be TelegramContextFull
  }
};

// ❌ ERROR: Wrong context type
const badTransport: Transport<TelegramContextFull> = {
  send: async (ctx: GitHubContextFull, text: string) => {
    // ERROR: GitHubContextFull is not assignable to TelegramContextFull
  }
};
```

---

## Part 7: Conditional Types (Advanced)

### Validate Based on Conditions

```typescript
// Advanced: Type depends on condition
export type AdminContextRequired<T> = T extends { isAdmin: true }
  ? T & { debugContext: DebugContext }  // If admin, debugContext required
  : T;  // Otherwise, original type

// Usage
function sendFooter<T extends TelegramContextFull>(
  ctx: AdminContextRequired<T>
): string {
  // If T has isAdmin=true, debugContext is required here
  return formatDebugFooter(ctx.debugContext);
}

// ✅ OK: isAdmin is true
sendFooter({
  token: 'abc',
  chatId: 123,
  isAdmin: true,
  debugContext: {...},
  // ... other required fields
});

// ❌ ERROR: isAdmin is false, so debugContext would be optional
sendFooter({
  token: 'abc',
  chatId: 123,
  isAdmin: false,
  debugContext: undefined,
  // ... other required fields
});
```

---

## Part 8: Real-World Validation Examples

### Example 1: Validate Function Arguments

```typescript
// ✅ GOOD: Type signature validates input
export function formatDebugFooter(ctx: AdminTelegramContext): string {
  // TypeScript ensures:
  // - ctx.isAdmin is true
  // - ctx.debugContext is defined (not optional)
  // - All required fields exist

  const footer = `[debug] ${ctx.debugContext.type}`;
  return footer;
}

// ✅ OK: Pass admin context
const adminCtx: AdminTelegramContext = {...};
const footer = formatDebugFooter(adminCtx);

// ❌ ERROR: Wrong type
const userCtx: TelegramContextFull = {...};
const footer = formatDebugFooter(userCtx);
// ERROR: Argument of type 'TelegramContextFull' is not assignable...
```

### Example 2: Validate Constructor Arguments

```typescript
export class TelegramContextBuilder {
  private data: Record<string, unknown> = {};

  setToken(token: string): this {
    if (!token) {
      throw new Error('token cannot be empty');
    }
    this.data.token = token;
    return this;
  }

  // ... more setters

  build(): TelegramContextFull {
    // TypeScript validates return type
    // Return value must have all required fields
    return this.data as unknown as TelegramContextFull;
  }
}

// ✅ Usage validates at compile time
const ctx = new TelegramContextBuilder()
  .setToken(token)
  .setChatId(chatId)
  // ... all required fields
  .build();  // Returns TelegramContextFull

// TypeScript knows ctx.token exists (required field)
console.log(ctx.token);  // ✅ OK
```

### Example 3: Validate Transport Usage

```typescript
// ✅ GOOD: Context type matches transport type
async function sendMessage(
  transport: Transport<TelegramContextFull>,
  ctx: TelegramContextFull,
  text: string
) {
  // TypeScript ensures ctx matches what transport expects
  await transport.send(ctx, text);  // ✅ OK
}

// ❌ ERROR: Wrong context type for transport
async function sendBadMessage(
  transport: Transport<GitHubContextFull>,
  ctx: TelegramContextFull,
  text: string
) {
  await transport.send(ctx, text);
  // ERROR: Argument of type 'TelegramContextFull' is not assignable to
  // parameter of type 'GitHubContextFull'
}
```

---

## Part 9: Enable Strict TypeScript Checks

### TypeScript Config (tsconfig.json)

```json
{
  "compilerOptions": {
    // ✅ STRICT MODE: Maximum validation
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Additional validation
    "exactOptionalPropertyTypes": true,  // ← We use this!
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
  }
}
```

### Result: Maximum Validation

```bash
$ bun run type-check
# With these settings, TypeScript catches:
# - Missing required fields
# - Undefined property access
# - Type mismatches
# - Unused variables
# - Implicit any types
# - Missing return statements
```

---

## Part 10: Validation Checklist

### At Compile Time (TypeScript)

- [x] All required fields present
- [x] No optional property access without check
- [x] Type matches function parameters
- [x] Union types valid values only
- [x] Readonly fields not mutated
- [x] Generics properly constrained

### At Runtime (Optional)

- [x] assertions for additional validation
- [x] Guard clauses for conditional logic
- [x] Middleware for cross-cutting validation

---

## Part 11: Type Validation in Our Implementation

### TelegramContextFull Interface ✅

```typescript
export interface TelegramContextFull {
  token: string;        // ✅ Required - must provide
  chatId: number;       // ✅ Required - must provide
  userId: number;       // ✅ Required - must provide
  isAdmin: boolean;     // ✅ Required - must provide
  text: string;         // ✅ Required - must provide
  startTime: number;    // ✅ Required - must provide
  messageId: number;    // ✅ Required - must provide
  isGroupChat: boolean; // ✅ Required - must provide
  username?: string;    // ✅ Optional - may omit
  debugContext?: DebugContext;  // ✅ Optional - may omit
}
```

### AdminTelegramContext Interface ✅

```typescript
export interface AdminTelegramContext extends TelegramContextFull {
  isAdmin: true;        // ✅ Narrowed from boolean
  debugContext: DebugContext;  // ✅ Required (no ?)
}
```

### Type Guard ✅

```typescript
// ✅ Type guards narrow from TelegramContextFull to AdminTelegramContext
export function isAdminContext(
  ctx: TelegramContextFull
): ctx is AdminTelegramContext {
  return ctx.isAdmin === true && ctx.debugContext !== undefined;
}
```

### Function Validation ✅

```typescript
// ✅ Requires AdminTelegramContext (stricter than TelegramContextFull)
export function formatDebugFooter(ctx: AdminTelegramContext): string {
  // Guaranteed:
  // - ctx.isAdmin is true
  // - ctx.debugContext is defined
  // - All required fields exist
}

// Usage ✅
if (isAdminContext(ctx)) {
  // Inside if block, ctx is narrowed to AdminTelegramContext
  formatDebugFooter(ctx);  // ✅ OK
}
```

---

## Part 12: Error Messages

### Clear Error Messages

TypeScript provides clear error messages when validation fails:

```typescript
const badContext: TelegramContextFull = {
  token: 'abc',
  // ... missing other fields
};

// Error message:
// TS2345: Argument of type '{ token: string; }' is not assignable to
// parameter of type 'TelegramContextFull'.
//   The following properties are missing in type '{ token: string; }':
//     chatId, userId, isAdmin, text, startTime, messageId, isGroupChat
```

### Lists Exactly What's Missing

```typescript
// With partial context
const partialContext: TelegramContextFull = {
  token: 'abc',
  chatId: 123,
  userId: 456,
  // Missing: isAdmin, text, startTime, messageId, isGroupChat
};

// Error shows exactly what's missing:
// chatId, userId, isAdmin, text, startTime, messageId, isGroupChat
```

---

## Summary: TypeScript Validation Benefits

| Type Validation | Benefit |
|-----------------|---------|
| Strict Interfaces | Catch missing fields at compile-time |
| Union Types | Only valid values allowed |
| Optional vs Required | Prevent undefined errors |
| Type Guards | Safe type narrowing |
| Readonly | Prevent accidental mutations |
| Generics | Reusable type validation |
| Conditional Types | Complex validation logic |

---

## Comparison: Compile-Time vs Runtime

| Approach | When | Cost | Catch Rate |
|----------|------|------|-----------|
| TypeScript | Compile | 0 (free) | 100% for syntax |
| Assertions | Runtime | Small | 100% for logic |
| Both | Both | Small | 100% total |

**Our Implementation**: Both TypeScript + Runtime = Maximum Safety ✅

---

## Quick Reference

```typescript
// 1. Define strict interface
export interface TelegramContextFull {
  token: string;  // ✅ Required
  debugContext?: DebugContext;  // ✅ Optional
}

// 2. Narrow with guard
function isAdmin(ctx: TelegramContextFull): ctx is AdminTelegramContext {
  return ctx.isAdmin === true && ctx.debugContext !== undefined;
}

// 3. Use safely
if (isAdmin(ctx)) {
  // ctx is AdminTelegramContext
  formatDebugFooter(ctx.debugContext);  // ✅ Safe!
}
```

---

## See Also

- `packages/cloudflare-agent/src/context-validation.ts` - Implementation
- `docs/context-typing-guide.md` - 5 validation approaches
- `docs/integration-guide.md` - How to use in your code
