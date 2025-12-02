---
title: Slack Setup
description: Extend transport tutorial. Add Slack webhook + DO integration. Platform abstraction pattern.
---

<!-- i18n: en -->

**TL;DR**: Extend Transport. Handle app_mention webhooks. Fire-and-forget to DO. Send/edit via Slack API.

## Table of Contents
- [Events Table](#events-table)
- [Transport Impl](#transport-impl)
- [Webhook Handler](#webhook-handler)
- [Integration Flow](#integration-flow)
- [Fire Quiz](#fire-quiz)

## Events Table

Slack Events API triggers.

| Event         | Trigger     | Handle |
|---------------|-------------|--------|
| app_mention   | @bot msg    | Parse text, queueMessage |
| message.im    | DM          | Direct chat |
| message.channels | Channel  | Team chat |

Subscribe via Slack API: `slack events subscribe`.

## Transport Impl

Extend [`packages/chat-agent/src/transport.ts`](packages/chat-agent/src/transport.ts).

```typescript
// Hypothetical slack-transport.ts
import type { Transport } from '@duyetbot/chat-agent';

export class SlackTransport implements Transport<SlackContext> {
  async send(ctx: SlackContext, text: string): Promise<MessageRef> {
    const res = await fetch(`https://slack.com/api/chat.postMessage`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.botToken}` },
      body: JSON.stringify({ channel: ctx.channel, text }),
    });
    const data = await res.json();
    return { ts: data.ts, channel: ctx.channel };
  }

  async edit(ctx: SlackContext, ref: MessageRef, text: string): Promise<void> {
    await fetch(`https://slack.com/api/chat.update`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.botToken}` },
      body: JSON.stringify({ channel: ref.channel, ts: ref.ts, text }),
    });
  }

  parseContext(event: SlackEvent): ParsedInput {
    return { text: event.text, userId: event.user };
  }
}
```

## Webhook Handler

Fire-and-forget pattern.

```typescript
// apps/slack-bot/src/index.ts (hypothetical)
app.post('/slack/events', async (c) => {
  const event = await c.req.json();
  const agent = getChatAgent(env.SlackAgent, event.channel);
  agent.queueMessage({ text: event.text, ... }).catch(() => {});
  return c.json({ challenge: c.req.query('challenge') });
});
```

Deploy: `bun run deploy:slack`.

## Integration Flow

```
┌───────────────┐     ┌───────────────┐     ┌─────────────────┐
│ Slack         │────→│ Webhook       │────→│ Parse +         │
│ @mention      │     │ /events       │     │ queueMessage    │
└───────────────┘     └───────────────┘     └────────┬────────┘
                                                     │
                                                     ▼
┌───────────────┐     ┌───────────────┐     ┌─────────────────┐
│ Process +     │←────│ SlackTransport│←────│ DO Alarm        │
│ Edit Response │     │ "Thinking..." │     │ 500ms           │
└───────────────┘     └───────────────┘     └─────────────────┘
```

Matches core transports.

## Fire Quiz

**Q**: Webhook returns?

A: 200 immediately, DO async ✅  
B: Await full process  
C: 202 Accepted

## Related
- [Core Transports →](/core-concepts/transports.md)

Create Slack app. Subscribe events. Test mentions!