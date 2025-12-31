# @duyetbot/analytics

Analytics and metrics collection for duyetbot-agent. Captures all messages and agent steps in append-only fashion for persistent observability.

## Features

- **Append-Only Architecture**: Never deletes data, only archives messages
- **UUID v7 Message IDs**: Time-ordered IDs for efficient querying and correlation
- **Agent Step Tracking**: Complete lifecycle tracking for agent execution
- **Token Usage Metrics**: Tracks input, output, cached, and reasoning tokens
- **Batch Operations**: Efficient batch message capture for high-throughput scenarios
- **Sequence Tracking**: Per-session message sequencing with in-memory cache for performance
- **Content Hash**: SHA-256 content hashing (first 16 chars) for deduplication checking

## Installation

```bash
bun add @duyetbot/analytics
```

## Usage

### Initialize Collector

```typescript
import { AnalyticsCollector } from "@duyetbot/analytics";

// Assuming you have a Cloudflare D1 database instance
const collector = new AnalyticsCollector(env.DB);
```

### Capture User Message

```typescript
const messageId = await collector.captureUserMessage({
  sessionId: "session-123",
  content: "What is the weather?",
  platform: "telegram",
  userId: "user-456",
  username: "john_doe",
  chatId: "chat-789",
  platformMessageId: "telegram-msg-123",
  eventId: "event-abc",
});
```

### Capture Assistant Response

```typescript
const responseId = await collector.captureAssistantMessage({
  sessionId: "session-123",
  content: "The weather is sunny.",
  platform: "telegram",
  userId: "user-456",
  triggerMessageId: messageId, // Link to user message
  eventId: "event-abc",
  inputTokens: 150,
  outputTokens: 50,
  cachedTokens: 0,
  reasoningTokens: 0,
  model: "claude-3-5-sonnet",
});
```

### Track Agent Steps

```typescript
// Start tracking an agent step
const stepId = collector.startAgentStep({
  eventId: "event-abc",
  messageId: responseId,
  agentName: "router-agent",
  agentType: "agent",
  sequence: 1,
});

// ... do work ...

// Complete the step
await collector.completeAgentStep(stepId, {
  status: "success",
  inputTokens: 100,
  outputTokens: 50,
  model: "claude-3-5-sonnet",
  toolsUsed: ["bash", "git"],
});
```

### Batch Message Capture

```typescript
const messageIds = await collector.captureMessages([
  {
    sessionId: "session-123",
    role: "user",
    content: "First message",
    platform: "telegram",
    userId: "user-456",
  },
  {
    sessionId: "session-123",
    role: "assistant",
    content: "First response",
    platform: "telegram",
    userId: "user-456",
    inputTokens: 100,
    outputTokens: 50,
  },
]);
```

### Message Management

```typescript
// Archive a message (doesn't delete, just marks archived)
await collector.archiveMessage(messageId);

// Pin a message
await collector.pinMessage(messageId);

// Change visibility
await collector.setMessageVisibility(messageId, "public");
```

## Types

### AnalyticsMessage

Complete message record with metadata:

```typescript
interface AnalyticsMessage {
  id: number;
  messageId: string; // UUID v7
  sessionId: string;
  conversationId?: string;
  parentMessageId?: string;
  sequence: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  contentHash?: string;
  visibility: "private" | "public" | "unlisted";
  isArchived: boolean;
  isPinned: boolean;
  eventId?: string;
  triggerMessageId?: string;
  platformMessageId?: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  platform: "telegram" | "github" | "cli" | "api";
  userId: string;
  username?: string;
  chatId?: string;
  repo?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}
```

### AnalyticsAgentStep

Complete agent step record:

```typescript
interface AnalyticsAgentStep {
  id: number;
  stepId: string; // UUID v7
  eventId: string;
  messageId: string | null;
  parentStepId: string | null;
  agentName: string;
  agentType: "agent" | "worker";
  sequence: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  queueTimeMs: number;
  status: "pending" | "running" | "success" | "error" | "cancelled";
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  errorType: string | null;
  errorMessage: string | null;
  retryCount: number;
  model: string | null;
  toolsUsed: string[] | null;
  toolCallsCount: number;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}
```

## Database Schema

The analytics collector requires two main tables in Cloudflare D1:

### analytics_messages

```sql
CREATE TABLE analytics_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  conversation_id TEXT,
  parent_message_id TEXT,
  sequence INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT,
  visibility TEXT DEFAULT 'private',
  is_archived INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  event_id TEXT,
  trigger_message_id TEXT,
  platform_message_id TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,
  platform TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  chat_id TEXT,
  repo TEXT,
  model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT
);

CREATE INDEX idx_session_sequence ON analytics_messages(session_id, sequence);
CREATE INDEX idx_user_created ON analytics_messages(user_id, created_at);
CREATE INDEX idx_event_id ON analytics_messages(event_id);
CREATE INDEX idx_message_id ON analytics_messages(message_id);
```

### analytics_agent_steps

```sql
CREATE TABLE analytics_agent_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL,
  message_id TEXT,
  parent_step_id TEXT,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  duration_ms INTEGER DEFAULT 0,
  queue_time_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,
  error_type TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  model TEXT,
  tools_used TEXT,
  tool_calls_count INTEGER DEFAULT 0,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_event_sequence ON analytics_agent_steps(event_id, sequence);
CREATE INDEX idx_agent_created ON analytics_agent_steps(agent_name, created_at);
CREATE INDEX idx_step_id ON analytics_agent_steps(step_id);
```

## API Reference

### AnalyticsCollector Methods

#### Constructor

```typescript
constructor(db: D1Database)
```

Initialize a new collector with a D1 database instance.

#### captureUserMessage()

```typescript
async captureUserMessage(input: {
  sessionId: string;
  content: string;
  platform: "telegram" | "github" | "cli" | "api";
  userId: string;
  username?: string;
  chatId?: string;
  platformMessageId?: string;
  eventId?: string;
}): Promise<string>
```

Capture a user message. Returns the generated message ID.

#### captureAssistantMessage()

```typescript
async captureAssistantMessage(input: {
  sessionId: string;
  content: string;
  platform: "telegram" | "github" | "cli" | "api";
  userId: string;
  triggerMessageId: string;
  eventId?: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  model?: string;
}): Promise<string>
```

Capture an assistant response. Returns the generated message ID.

#### captureSystemMessage()

```typescript
async captureSystemMessage(input: {
  sessionId: string;
  role: "system" | "tool";
  content: string;
  platform: "telegram" | "github" | "cli" | "api";
  userId: string;
  eventId?: string;
  parentMessageId?: string;
  model?: string;
}): Promise<string>
```

Capture a system or tool message. Returns the generated message ID.

#### startAgentStep()

```typescript
startAgentStep(input: StepCreateInput): string
```

Start tracking an agent step. Returns the step ID for later completion.

#### completeAgentStep()

```typescript
async completeAgentStep(
  stepId: string,
  completion: StepCompletion
): Promise<void>
```

Complete an agent step with results. Must have called `startAgentStep` first.

#### captureMessages()

```typescript
async captureMessages(messages: MessageCreateInput[]): Promise<string[]>
```

Batch capture multiple messages efficiently. Returns array of message IDs.

#### archiveMessage()

```typescript
async archiveMessage(messageId: string): Promise<void>
```

Mark a message as archived (append-only, doesn't delete).

#### pinMessage()

```typescript
async pinMessage(messageId: string): Promise<void>
```

Pin a message for easy reference.

#### setMessageVisibility()

```typescript
async setMessageVisibility(
  messageId: string,
  visibility: "private" | "public" | "unlisted"
): Promise<void>
```

Change message visibility level.

#### clearSequenceCache()

```typescript
clearSequenceCache(): void
```

Clear the in-memory sequence counter cache.

#### getPendingStepCount()

```typescript
getPendingStepCount(): number
```

Get count of pending agent steps.

#### getPendingStepIds()

```typescript
getPendingStepIds(): string[]
```

Get array of pending step IDs.

## Architecture

### Append-Only Design

The analytics collector implements a strict append-only architecture:

- Messages are never deleted, only archived
- Status updates create new records or update existing ones
- Full audit trail is preserved for compliance and debugging
- Improves query performance and enables time-series analysis

### UUID v7 Ordering

Message and step IDs use UUID v7 for:

- Time-ordered insertion (sortable by timestamp)
- Natural chronological ordering without separate timestamp indexes
- Efficient range queries and pagination
- Distributed ID generation without coordination

### Sequence Tracking

Per-session message sequencing enables:

- Conversation flow analysis
- Message order verification
- Pagination in chronological order
- Efficient gap detection

### In-Memory Caching

Sequence counters are cached in-memory to:

- Reduce database queries during batch operations
- Improve capture throughput
- Minimize latency for time-sensitive operations
- Graceful degradation with database lookup fallback

## Performance Considerations

- **Batch Operations**: Use `captureMessages()` for high-volume message capture
- **Sequence Cache**: Cached per-session for improved repeated access
- **Content Hashing**: Computed asynchronously using SubtleCrypto
- **Database Indexes**: Create recommended indexes for optimal query performance
- **Pending Steps**: In-memory tracking minimizes database transactions until completion

## Error Handling

All database operations include error logging:

```typescript
try {
  await collector.captureUserMessage(...);
} catch (error) {
  console.error("Failed to capture message:", error);
  // Handle error appropriately
}
```

## Integration with CloudflareChatAgent

The collector is designed to integrate with `CloudflareChatAgent`:

1. **Session Creation**: Pass `sessionId` when agent is initialized
2. **Message Capture**: Call capture methods during message routing and response
3. **Step Tracking**: Wrap agent/worker execution with step tracking
4. **Error Logging**: Capture errors with step completion

Example integration:

```typescript
// In CloudflareChatAgent handler
const sessionId = "session-" + ctx.sender.id;

// Capture incoming message
const messageId = await analytics.captureUserMessage({
  sessionId,
  content: text,
  platform: "telegram",
  userId: ctx.sender.id.toString(),
});

// Track router execution
const stepId = analytics.startAgentStep({
  eventId: messageId,
  agentName: "router-agent",
  agentType: "agent",
  sequence: 1,
});

try {
  // Execute router
  const result = await router.dispatch(text);

  // Complete step
  await analytics.completeAgentStep(stepId, {
    status: "success",
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
  });

  // Capture response
  await analytics.captureAssistantMessage({
    sessionId,
    content: result.text,
    triggerMessageId: messageId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
    platform: "telegram",
    userId: ctx.sender.id.toString(),
  });
} catch (error) {
  await analytics.completeAgentStep(stepId, {
    status: "error",
    inputTokens: 0,
    outputTokens: 0,
    errorType: error.name,
    errorMessage: error.message,
  });
  throw error;
}
```

## License

MIT
