# Telegram Bot - Debugging Reference

## Fire-and-Forget Flow (RouterAgent)

This is the main message processing flow when Telegram sends a message:

```
1. Webhook → telegram-bot/index.ts
   └─ Creates ParsedInput with messageRef (message_id from Telegram)
   └─ Calls agent.receiveMessage(parsedInput)

2. CloudflareAgent.receiveMessage() → cloudflare-agent.ts:2134
   └─ Queues message in pendingBatch
   └─ Schedules batch alarm

3. CloudflareAgent.onBatchAlarm() → cloudflare-agent.ts
   └─ Sends thinking message via transport.send() → returns messageRef
   └─ Builds ResponseTarget with:
      - chatId, platform, botToken
      - messageRef: { messageId: <number from transport.send()> }
      - adminUsername, username (for debug footer)
   └─ Calls scheduleRouting() → fires RouterAgent alarm

4. RouterAgent.onExecutionAlarm() → router-agent.ts:1032
   └─ Guards against corrupted state (missing context, query, or messageRef)
   └─ Calls this.route(execution.context) → classify → dispatch
   └─ Calls sendPlatformResponse() with debugContext
   └─ On error: tries to send error message (if messageRef valid)
```

## Common Issues

### `"Cannot read properties of undefined (reading 'length')"`
- **Cause**: Corrupted state from Durable Object storage migration
- **Check**: `execution.context.query` or `execution.context.conversationHistory` is undefined
- **Fix**: Guard added at `router-agent.ts:1044-1071` to detect and clean up corrupted state

### `"Cannot send error message, no valid messageRef"`
- **Cause**: `execution.responseTarget.messageRef.messageId` is undefined
- **Check**: Initial thinking message failed to send (transport.send() error)
- **Fix**: Validation at function start now catches this before processing

### Debug footer not showing
- **Check 1**: `ctx.isAdmin` must be `true`
- **Check 2**: `adminUsername` must match `username` (case-insensitive, without @)
- **Files**:
  - `platform-response.ts:78` - isAdminUser check
  - `apps/telegram-bot/src/debug-footer.ts` - formatDebugFooter

## Key Files

| File | Purpose |
|------|---------|
| `router-agent.ts:1032` | onExecutionAlarm handler |
| `router-agent.ts:1044-1071` | Corruption guard (validates context, query, responseTarget, messageRef) |
| `platform-response.ts:78` | isAdminUser check for debug footer |
| `cloudflare-agent.ts:2848` | transport.send() returns messageRef |
| `cloudflare-agent.ts:2954-2964` | ResponseTarget construction |

## Debug Footer Flow

```
ResponseTarget built in cloudflare-agent.ts:2954-2964
  └─ adminUsername: from ctx or env.ADMIN_USERNAME
  └─ username: from ctx or firstMessage.username

sendPlatformResponse() in platform-response.ts
  └─ isAdminUser() checks adminUsername === username (normalized)
  └─ If admin: formatDebugFooter(debugContext) appended to message
```
