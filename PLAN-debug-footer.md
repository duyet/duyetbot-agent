# Debug Footer Fix & Enhancement Plan

## Problem Statement

The debug footer is not appearing for admin users. This document analyzes the issue and proposes fixes.

## Current Architecture

### Three Rendering Paths

1. **Direct Transport Path** (CloudflareAgent → Transport)
   ```
   CloudflareAgent.handle()
     → StepProgressTracker (populates debugContext)
     → ctx.debugContext = stepTracker.getDebugContext()
     → transport.send()/edit()
     → prepareMessageWithDebug()
     → formatDebugFooter()
   ```

2. **Fire-and-Forget Path** (RouterAgent → Platform)
   ```
   CloudflareAgent.handle()
     → RouterAgent.scheduleRouting()
     → [alarm triggers]
     → RouterAgent.executeRouting()
     → sendPlatformResponse(env, target, text, debugContext)
     → formatDebugFooter(debugContext) // for admin
   ```

3. **Step Progress Updates** (during processing)
   ```
   StepProgressTracker.addStep()
     → onUpdate(message) callback
     → ctx.debugContext = stepTracker.getDebugContext()
     → transport.edit()
   ```

### Key Components

| File | Role |
|------|------|
| `packages/cloudflare-agent/src/debug-footer.ts` | Core formatter (HTML/MarkdownV2/Markdown) |
| `packages/cloudflare-agent/src/step-progress.ts` | Tracks routing flow, timing, tokens |
| `packages/cloudflare-agent/src/platform-response.ts` | Fire-and-forget response sender |
| `apps/telegram-bot/src/debug-footer.ts` | Admin wrapper + parseMode handling |
| `apps/github-bot/src/debug-footer.ts` | Admin wrapper for GitHub |

## Root Cause Analysis

### Potential Issues

1. **Empty routingFlow** - `formatDebugFooter()` returns `null` when `routingFlow.length === 0`
   - Direct path: StepProgressTracker not calling `startRouter()`/`completeRouter()`
   - Fire-and-forget: RouterAgent builds context, but may skip if routing fails

2. **isAdmin Check Failure** - Footer only shows for admin users
   - `isAdmin` computed from `username === adminUsername`
   - Case sensitivity issues (both are normalized with `@` removal)
   - `adminUsername` or `username` may be undefined

3. **debugContext Not Passed**
   - Context not attached to TelegramContext before transport calls
   - Fire-and-forget: `debugContext` not passed to `sendPlatformResponse()`

## Investigation Checklist

- [ ] Verify `isAdmin` is true for test user
- [ ] Verify `debugContext.routingFlow` is populated
- [ ] Check logs for routing path taken (direct vs fire-and-forget)
- [ ] Verify `adminUsername` is set in env
- [ ] Check if `stepTracker` is created and used

## Proposed Enhancements

### Phase 1: Add Diagnostic Logging

Add logging to trace the footer flow:

```typescript
// In platform-response.ts
logger.debug('[sendPlatformResponse] Admin check', {
  isAdmin: isAdminUser(target),
  username: target.username,
  adminUsername: target.adminUsername,
  hasDebugContext: !!debugContext,
  routingFlowLength: debugContext?.routingFlow?.length ?? 0,
});
```

### Phase 2: Enhanced Debug Footer Content

Current format:
```
🔍 router-agent (0.4s) → [simple/general/low] → simple-agent (3.77s)
   🔧 Tools: search, calculator
```

Enhanced format with more useful info:
```
🔍 router-agent (0.4s, 500↓/100↑) → [simple/general/low] → simple-agent (3.77s, 1.2k↓/0.5k↑)
   🔧 Tools: search, calculator
   📊 Model: claude-3-5-sonnet
   🆔 trace-123abc
```

New fields to add:
- **Model name** - Which LLM model was used
- **Trace ID** - For correlating with logs
- **Cache hit rate** - If prompt caching used
- **Request ID** - For debugging specific requests

### Phase 3: Fallback Debug Info

When full routing context isn't available, show minimal info:

```typescript
// In debug-footer.ts
export function formatDebugFooter(debugContext?: DebugContext): string | null {
  // If no routing flow but has other debug info, show that
  if (!debugContext?.routingFlow?.length) {
    if (debugContext?.totalDurationMs || debugContext?.metadata) {
      return formatMinimalDebugFooter(debugContext);
    }
    return null;
  }
  // ... existing logic
}

function formatMinimalDebugFooter(debugContext: DebugContext): string {
  const parts: string[] = [];

  if (debugContext.totalDurationMs) {
    parts.push(`⏱️ ${(debugContext.totalDurationMs / 1000).toFixed(2)}s`);
  }

  if (debugContext.metadata?.model) {
    parts.push(`📊 ${debugContext.metadata.model}`);
  }

  if (debugContext.metadata?.traceId) {
    parts.push(`🆔 ${debugContext.metadata.traceId.slice(0, 8)}`);
  }

  if (parts.length === 0) return null;

  return `\n\n<blockquote expandable>🔍 ${parts.join(' | ')}</blockquote>`;
}
```

### Phase 4: Ensure Context Propagation

Make sure debugContext flows through all paths:

1. **Direct path fix** - Ensure `ctx.debugContext` is always set:
```typescript
// In cloudflare-agent.ts after chat()/routeQuery()
// Always set debug context, even if stepTracker wasn't used
const ctxWithDebug = ctx as unknown as { debugContext?: DebugContext };
ctxWithDebug.debugContext = stepTracker?.getDebugContext() ?? {
  routingFlow: [],
  totalDurationMs: Date.now() - handleStartTime,
};
```

2. **Fire-and-forget fix** - Validate context before sending:
```typescript
// In router-agent.ts before sendPlatformResponse
if (!debugContext.routingFlow.length) {
  logger.warn('[RouterAgent] Empty routing flow in debug context');
  debugContext.routingFlow.push({ agent: 'router-agent' });
}
```

## Implementation Order

1. [ ] Add diagnostic logging to trace the issue
2. [ ] Fix any context propagation issues found
3. [ ] Add model name to debug context
4. [ ] Add trace ID to debug footer
5. [ ] Implement fallback minimal debug footer
6. [ ] Add token usage visualization
7. [ ] Update tests

## Files to Modify

- `packages/cloudflare-agent/src/debug-footer.ts` - Enhanced format
- `packages/cloudflare-agent/src/step-progress.ts` - Track model, traceId
- `packages/cloudflare-agent/src/platform-response.ts` - Add logging
- `packages/cloudflare-agent/src/types.ts` - Add new DebugMetadata fields
- `packages/cloudflare-agent/src/cloudflare-agent.ts` - Ensure context propagation
- `apps/telegram-bot/src/debug-footer.ts` - Support new format
- `apps/github-bot/src/debug-footer.ts` - Support new format
