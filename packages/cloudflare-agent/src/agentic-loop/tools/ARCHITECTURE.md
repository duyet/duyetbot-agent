# Approval Tool Architecture

## Overview

The approval tool provides a modern, tool-based approach to human-in-the-loop (HITL) approval workflows. It replaces the legacy `HITLAgent` class with a composable tool that integrates seamlessly with the agentic loop system.

## Key Architectural Improvements

### 1. Tool-Based Integration (Not Agent-Based)

**Legacy (HITLAgent):**
- Separate agent class requiring special handling
- Non-composable with other agent types
- Required duplicate logic in multiple agent implementations
- Hard to test in isolation

**Modern (Approval Tool):**
- Standard `LoopTool` interface
- Composes naturally with other tools
- Single implementation used everywhere
- Fully unit testable
- Integrates with `ToolExecutor` for execution

### 2. Non-Blocking Execution

**Legacy:**
```
Agent → HITL System → Wait for user → Resume
        (blocks execution)
```

**Modern:**
```
Agent → Approval Tool → Return pending status → Transport handles user input
        (immediate return)       (async flow)
```

The approval tool returns immediately with a special status marker, allowing the agentic loop to continue processing other tasks or waiting for input asynchronously.

### 3. Type-Safe Data Structure

**Legacy:**
- Approval state scattered across multiple variables
- Implicit contracts between components

**Modern:**
```typescript
interface ApprovalRequest {
  action: string;           // Clear description of action
  reason: string;           // Why it's needed
  riskLevel: 'low' | 'medium' | 'high' | 'critical';  // Risk assessment
  timestamp: number;        // When it was requested
  requestId: string;        // Unique identifier for tracking
}
```

### 4. Composable Risk Levels

Decisions can be made based on risk assessment:

```typescript
const approvalTool.execute({
  action: 'Delete production data',
  reason: 'GDPR compliance',
  risk_level: 'critical'  // Framework can auto-approve low-risk, require high-touch for critical
});
```

## Flow Diagrams

### Standard Approval Flow

```
┌─────────────────┐
│  Agent Thinks   │
│  & Plans        │
└────────┬────────┘
         │
         ├─→ Regular tools (read, search, plan)
         │      ↓
         │   [Success]
         │      ↓
         ├─→ Sensitive operation → request_approval tool
         │      ↓
         │   [Approval Pending]
         │      ↓
         │   Transport Layer
         │   ┌─────────────────┐
         │   │ Format message  │
         │   │ & show to user  │
         │   └────────┬────────┘
         │            │
         │   ┌────────▼────────┐
         │   │ Wait for user   │
         │   │ input (approve/ │
         │   │ reject)         │
         │   └────────┬────────┘
         │            │
         │   ┌────────▼────────────┐
         │   │ Resume loop with    │
         │   │ approval result     │
         │   └────────┬────────────┘
         │            │
         └─→─────────┬─────────┐
                     ├─ Continue (if approved)
                     └─ Terminate (if rejected)
```

### Agent Loop Iteration with Approval

```
Iteration N:
  ┌─────────────────────────────────┐
  │ LLM generates tool calls        │
  │ - read_file, search, etc.       │
  │ - request_approval ← NEW        │
  └────────────┬────────────────────┘
               │
        ┌──────▼──────┐
        │ Tool        │
        │ Executor    │
        └──────┬──────┘
               │
        ┌──────▼──────────────────┐
        │ Regular tool: execute    │
        │ return success=true      │
        │                          │
        │ Approval tool: return    │
        │ success=false            │
        │ status=awaiting_approval │
        └──────┬──────────────────┘
               │
        ┌──────▼──────────────────────────┐
        │ Transport detects                │
        │ awaiting_approval status         │
        │                                  │
        │ Pause loop, wait for user        │
        │ (doesn't continue auto)          │
        └──────┬──────────────────────────┘
               │
        Iteration N+1: Resumed by user input
```

## Transport Layer Integration

Each platform transport layer must implement approval handling:

### Telegram Transport

```typescript
// 1. Detect approval pending
if (loopResult.data?.status === 'awaiting_approval') {
  // 2. Store request
  await approvalStore.save(loopResult.data.requestId, {
    request: loopResult.data.request,
    chatId: update.message.chat.id,
    userId: update.message.from.id,
    timestamp: Date.now()
  });

  // 3. Send formatted message with buttons
  await bot.api.sendMessage(chatId, loopResult.output, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `app_${requestId}_yes` },
          { text: '❌ Reject', callback_data: `app_${requestId}_no` }
        ]
      ]
    }
  });
}

// 4. Handle callback (user clicked button)
bot.on('callback_query', async (ctx) => {
  const [action, requestId, response] = ctx.callbackQuery.data.split('_');
  const approved = response === 'yes';

  // 5. Resume loop with approval
  const resumeResult = await loop.resume(requestId, approved);

  // 6. Send result
  await bot.api.answerCallbackQuery(ctx.callbackQuery.id);
  await bot.api.sendMessage(chatId, resumeResult.output);
});
```

### GitHub Transport

```typescript
// 1. Detect approval pending
if (loopResult.data?.status === 'awaiting_approval') {
  // 2. Create comment with approval request
  const comment = await github.rest.issues.createComment({
    owner, repo, issue_number,
    body: loopResult.output +
          '\n\nRespond with `/approve` or `/reject` to proceed.'
  });

  // 3. Store request
  await approvalStore.save(loopResult.data.requestId, {
    issueNumber,
    commentId: comment.data.id,
    requestedBy: context.sender.login
  });
}

// 4. Handle approval command
bot.on('issue_comment', async (context) => {
  const comment = context.payload.comment.body;
  const match = comment.match(/\/(approve|reject)/);

  if (match) {
    const approved = match[1] === 'approve';
    const requestId = extractFromContext(context);

    // 5. Resume loop
    const resumeResult = await loop.resume(requestId, approved);

    // 6. Reply to comment
    await github.rest.issues.createComment({
      owner, repo, issue_number,
      body: resumeResult.output
    });
  }
});
```

## State Machine

The approval request goes through these states:

```
┌─────────────────┐
│   CREATED       │  (approval_tool.execute() called)
└────────┬────────┘
         │
         ↓
┌─────────────────────────┐
│  AWAITING_APPROVAL      │  (transport waiting for user)
└────────┬────────────────┘
         │
    ┌────┴────┐
    │          │
    ↓          ↓
┌────────┐  ┌────────┐
│APPROVED│  │REJECTED│
└────┬───┘  └────┬───┘
     │           │
     ↓           ↓
┌──────────────────┐
│   COMPLETED      │  (loop resumed with result)
└──────────────────┘
```

## Database Schema (Optional)

For persistence across sessions:

```sql
CREATE TABLE approval_requests (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,

  -- Context for resumption
  loop_id TEXT,
  platform TEXT,        -- 'telegram', 'github'
  platform_context JSONB,  -- Serialized context for resumption

  -- Response
  status TEXT,  -- 'pending', 'approved', 'rejected'
  approved_by TEXT,
  approved_at INTEGER,

  UNIQUE(loop_id)
);

CREATE TABLE approval_audit_log (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES approval_requests(id),
  action TEXT,  -- 'created', 'approved', 'rejected'
  actor TEXT,
  timestamp INTEGER,
  notes TEXT
);
```

## Comparison: Legacy vs. Modern

| Aspect | Legacy HITLAgent | Modern Approval Tool |
|--------|------------------|---------------------|
| **Architecture** | Separate agent class | Standard `LoopTool` |
| **Composability** | Not composable | Fully composable |
| **Type Safety** | Implicit contracts | Explicit `ApprovalRequest` |
| **Execution** | Blocking | Non-blocking, async |
| **Risk Levels** | Binary approve/reject | Four-level risk scale |
| **Testing** | Requires agent context | Unit testable in isolation |
| **Platform Integration** | Duplicate logic | Centralized, reusable |
| **Audit Trail** | Limited | Full request/response tracking |
| **Extensibility** | Hard to extend | Easy to customize |

## Future Enhancements

### 1. Auto-Approval Based on Risk

```typescript
const config = {
  autoApprove: {
    low: true,      // Auto-approve low-risk
    medium: false,  // Always ask for medium
    high: false,
    critical: false
  },
  approveOnBehalf: {
    // Special approvers for critical operations
    critical: ['admin@company.com']
  }
};
```

### 2. Approval Delegation

```typescript
// Request approval from specific user/team
const result = await approvalTool.execute({
  action: '...',
  reason: '...',
  approveOnBehalf: 'infrastructure-team'  // vs. current user
});
```

### 3. Multi-Level Approval

```typescript
// Require multiple approvers for critical operations
const result = await approvalTool.execute({
  action: '...',
  reason: '...',
  requiredApprovers: 2  // Need 2 approvals
});
```

### 4. Webhook Integration

```typescript
// Send approval request to external system
const result = await approvalTool.execute({
  action: '...',
  reason: '...',
  webhookUrl: 'https://approval-service.company.com/approve'
});
```

## Security Considerations

### 1. Rate Limiting

Prevent approval spam:
```typescript
// Max 10 approval requests per hour per user
const rateLimiter = new RateLimiter('approval', {
  window: 3600,
  maxRequests: 10
});
```

### 2. Request Expiration

Approval requests automatically expire:
```typescript
const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
```

### 3. Audit Logging

All approvals are logged:
```typescript
logger.info('Approval processed', {
  requestId,
  action,
  approved,
  approvedBy,
  timestamp: Date.now()
});
```

### 4. Access Control

Only authorized users can approve:
```typescript
if (!isAuthorizedApprover(user, riskLevel)) {
  throw new Error(`Not authorized to approve ${riskLevel} operations`);
}
```
