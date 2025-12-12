# Approval Tool Usage Examples

## Basic Setup

Register the approval tool with the agentic loop:

```typescript
import { ToolExecutor } from '../tool-executor.js';
import { approvalTool } from './approval.js';

const executor = new ToolExecutor();
executor.register(approvalTool);

// Pass executor to AgenticLoop
const loop = new AgenticLoop(config, executor);
```

## Scenario 1: File Deletion Approval

Agent detects the need to delete a file and requests approval:

```typescript
// Agent decides to clean up temporary files
const result = await executor.execute(ctx, {
  id: 'call_123',
  name: 'request_approval',
  arguments: {
    action: 'Delete file: /tmp/deployment_cache_2024-01-15.json',
    reason: 'Clear old deployment artifacts to free up storage',
    risk_level: 'low'
  }
});

// Output:
// {
//   success: false,
//   output: `
//     🔐 Approval Required
//
//     Action: Delete file: /tmp/deployment_cache_2024-01-15.json
//     Reason: Clear old deployment artifacts to free up storage
//     Risk Level: 🟡 LOW
//
//     Please respond with: **approve** or **reject**
//   `,
//   data: {
//     status: 'awaiting_approval',
//     requestId: 'approval_1702345678000_abc123def',
//     request: {
//       action: 'Delete file: /tmp/deployment_cache_2024-01-15.json',
//       reason: 'Clear old deployment artifacts to free up storage',
//       riskLevel: 'low',
//       timestamp: 1702345678000,
//       requestId: 'approval_1702345678000_abc123def'
//     }
//   },
//   durationMs: 2
// }
```

## Scenario 2: Database Migration Approval

Critical database operation requiring explicit approval:

```typescript
const result = await executor.execute(ctx, {
  id: 'call_456',
  name: 'request_approval',
  arguments: {
    action: 'Execute migration: Drop table users_legacy and migrate data to users_v2',
    reason: 'Upgrade to new user schema with improved permissions and audit trail',
    risk_level: 'critical'
  }
});

// Output includes:
// Risk Level: 🚨 CRITICAL
```

## Scenario 3: Force Push Approval

Git operation requiring high-level approval:

```typescript
const result = await executor.execute(ctx, {
  id: 'call_789',
  name: 'request_approval',
  arguments: {
    action: 'Force push to main branch (rewrite last 3 commits)',
    reason: 'Remove accidental commit containing AWS credentials (security incident)',
    risk_level: 'critical'
  }
});
```

## Integration with Transport Layer (Telegram)

The transport layer detects `awaiting_approval` status:

```typescript
// In telegram-bot's message handler
async function handleMessage(ctx, parsedInput) {
  const loopResult = await loop.run(parsedInput.query);

  // Check if approval is pending
  if (loopResult.success === false &&
      loopResult.debug?.approvalStatus === 'awaiting_approval') {

    // Store the approval request for later
    await store.saveApprovalRequest(loopResult.debug.requestId, {
      loopId: loopResult.loopId,
      message: loopResult.output,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    // Send formatted message to user
    await ctx.reply(loopResult.output);

    // Show inline buttons for approve/reject
    await ctx.reply('Confirm action:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `approval_approve_${requestId}` },
            { text: '❌ Reject', callback_data: `approval_reject_${requestId}` }
          ]
        ]
      }
    });
  } else {
    // Normal response
    await ctx.reply(loopResult.output);
  }
}
```

## Integration with Transport Layer (GitHub)

Handle approvals via GitHub comments:

```typescript
// In github-bot's issue handler
async function handleMention(context) {
  const loopResult = await loop.run(mentionContent);

  if (loopResult.needsApproval) {
    // Create a comment with the approval request
    const comment = await github.rest.issues.createComment({
      issue_number: context.issue.number,
      body: loopResult.output + '\n\nRespond with `/approve` or `/reject` to proceed.'
    });

    // Store approval request
    await store.saveApprovalRequest(loopResult.requestId, {
      issueNumber: context.issue.number,
      commentId: comment.data.id,
      loopId: loopResult.loopId
    });
  }
}

// Handle approval command
async function handleApprovalCommand(context, command, approved) {
  const requestId = extractRequestId(context.payload.comment.body);
  const request = await store.getApprovalRequest(requestId);

  // Resume the paused loop with approval result
  const resumeResult = await loop.resume(request.loopId, {
    approved,
    approvedBy: context.sender.login,
    approvedAt: Date.now()
  });

  // Post result as comment
  await github.rest.issues.createComment({
    issue_number: request.issueNumber,
    body: resumeResult.output
  });
}
```

## Programmatic Approval Creation

For testing or custom workflows:

```typescript
import { createApprovalRequest } from './approval.js';

// Create an approval request manually
const request = createApprovalRequest(
  'Deploy to production',
  'Release v2.0.0 with new features',
  'high'
);

console.log(request);
// {
//   action: 'Deploy to production',
//   reason: 'Release v2.0.0 with new features',
//   riskLevel: 'high',
//   timestamp: 1702345678000,
//   requestId: 'approval_1702345678000_abc123def'
// }
```

## Formatting Approval Results

Show formatted approval results to users:

```typescript
import { formatApprovalResult } from './approval.js';

// User approved
const approvedMsg = formatApprovalResult(
  true,
  'Deploy to production'
);
// Output: "✅ Approved: Deploy to production"

// User rejected
const rejectedMsg = formatApprovalResult(
  false,
  'Deploy to production'
);
// Output: "❌ Rejected: Deploy to production"
```

## Error Handling

The approval tool validates inputs and returns descriptive errors:

```typescript
// Missing required field
const result = await executor.execute(ctx, {
  id: 'call_1',
  name: 'request_approval',
  arguments: {
    reason: 'Some reason'
    // Missing 'action'
  }
});

// Result:
// {
//   success: false,
//   output: 'Error: action description is required',
//   error: 'action parameter is empty',
//   durationMs: 1
// }

// Invalid risk level
const result2 = await executor.execute(ctx, {
  id: 'call_2',
  name: 'request_approval',
  arguments: {
    action: 'Some action',
    reason: 'Some reason',
    risk_level: 'invalid'
  }
});

// Result:
// {
//   success: false,
//   output: "Error: invalid risk level 'invalid'. Must be one of: low, medium, high, critical",
//   error: 'invalid risk_level',
//   durationMs: 1
// }
```

## Risk Level Guidelines

### Low Risk (🟡)
Actions that are easily reversible with minimal impact:
- Creating backups
- Generating reports
- Adding non-critical features
- Creating test data

### Medium Risk (🟠 - default)
Actions that require attention but are relatively safe:
- Updating configuration
- Adding database indexes
- Updating dependencies
- Modifying user preferences

### High Risk (🔴)
Significant impact but can be recovered:
- Deleting user accounts
- Dropping database tables (with backup)
- Force pushing to development branches
- Deleting large amounts of data

### Critical (🚨)
Irreversible or extremely high-impact:
- Force pushing to main branch
- Deleting production databases
- Modifying encryption keys
- Removing access controls
- Data exfiltration

## Timeout Handling

Approval requests expire after 24 hours (configurable):

```typescript
// Store approval request with expiration
const expirationTime = Date.now() + 24 * 60 * 60 * 1000;

await store.saveApprovalRequest(requestId, {
  request,
  expiresAt: expirationTime
});

// Check expiration before processing approval
const saved = await store.getApprovalRequest(requestId);
if (Date.now() > saved.expiresAt) {
  return {
    success: false,
    error: 'Approval request expired. Please start over.'
  };
}
```

## Audit Logging

Track all approval requests and responses:

```typescript
import { logger } from '@duyetbot/hono-middleware';

// Log approval request
logger.info('Approval requested', {
  requestId,
  action: request.action,
  riskLevel: request.riskLevel,
  userId: context.user.id
});

// Log approval response
logger.info('Approval responded', {
  requestId,
  approved: true,
  approvedBy: context.user.id,
  timestamp: Date.now()
});
```

## Testing Approval Tool

```typescript
import { describe, it, expect } from 'vitest';
import { approvalTool, createApprovalRequest } from './approval.js';

describe('Approval Tool Integration', () => {
  it('should request approval for sensitive operations', async () => {
    const result = await approvalTool.execute({
      action: 'Delete user account',
      reason: 'GDPR request',
      risk_level: 'high'
    }, mockContext);

    expect(result.success).toBe(false);
    expect(result.data.status).toBe('awaiting_approval');
    expect(result.output).toContain('Approval Required');
  });
});
```
