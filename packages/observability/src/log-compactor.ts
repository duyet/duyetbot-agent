/**
 * Log Compaction Utilities for Cleaner Observability
 *
 * Reduces verbose logs while preserving critical information.
 * Key optimizations:
 * - Compact "State updated" with message count
 * - Compress event timestamps
 * - Abbreviate common field names
 * - One-line formatting for high-frequency events
 */

export interface CompactLogOptions {
  /** Hide message IDs and internal refs */
  hideRefs?: boolean;
  /** Max lines per log entry (for multi-line content) */
  maxLines?: number;
  /** Abbr field names: 'displayMessage' → 'msg', 'timestamp' → 't' */
  abbreviate?: boolean;
}

/**
 * Compact "State updated" events with message count
 *
 * Input:
 *   displayMessage: 'State updated'
 *   payload: {}
 *   timestamp: 1765739728961
 *   type: 'state:update'
 *
 * Output (with abbreviate=true):
 *   [state] msgs:20 | t:1765739728961
 */
export function compactStateUpdate(
  log: Record<string, unknown>,
  opts: CompactLogOptions = {}
): string {
  const messages = (log.payload as any)?.messages;
  const msgCount = Array.isArray(messages) ? messages.length : '?';
  const timestamp = opts.abbreviate
    ? (log.t ?? log.timestamp)?.toString().slice(-6)
    : log.timestamp;

  return `[state] msgs:${msgCount} | t:${timestamp}`;
}

/**
 * Format DebugContext compactly for logs
 *
 * Converts:
 *   { messages: [...100 items...], state: {...}, metadata: {...} }
 *
 * To:
 *   { messages: [<user msg 1>, <assistant msg 1>, ...] }
 */
export function compactDebugContext(
  context: Record<string, unknown>,
  opts: CompactLogOptions = {}
): Record<string, unknown> {
  if (!context.messages || !Array.isArray(context.messages)) {
    return context;
  }

  const messages = context.messages as Record<string, unknown>[];
  if (messages.length <= 4) {
    return context; // Keep original if already small
  }

  // Show first and last message only
  const first = messages[0];
  const last = messages[messages.length - 1];

  const compacted = {
    messages: [
      {
        role: first?.role || 'user',
        type: first?.type || 'text',
        ...(opts.hideRefs ? {} : { id: first?.id }),
      },
      first !== last
        ? {
            role: last?.role || 'assistant',
            type: last?.type || 'text',
            ...(opts.hideRefs ? {} : { id: last?.id }),
          }
        : undefined,
    ].filter(Boolean),
    messageCount: messages.length,
  };

  // Include non-message fields
  const { messages: _, ...rest } = context;
  return { ...rest, ...compacted };
}

/**
 * Transform log object to compact representation
 *
 * Rules:
 * - "State updated" → single line with message count
 * - Large arrays/objects → count instead of full content
 * - Refs (IDs, trace) → truncate to 8 chars
 * - Remove redundant event metadata
 */
export function compactLog(
  log: Record<string, unknown>,
  opts: CompactLogOptions = {}
): string | Record<string, unknown> {
  // Compact state update events
  if (log.displayMessage === 'State updated' || log.type === 'state:update') {
    return compactStateUpdate(log, opts);
  }

  // Compact large objects
  const compacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(log)) {
    if (key === 'messages' && Array.isArray(value) && value.length > 10) {
      // Compress messages array
      compacted[opts.abbreviate ? 'msgs' : key] = `<${value.length} items>`;
    } else if (key === 'timestamp' || key === 't') {
      // Abbreviate timestamps
      compacted[opts.abbreviate ? 't' : key] =
        typeof value === 'number' ? value.toString().slice(-6) : value;
    } else if (
      (key === 'traceId' || key === 'requestId' || key === 'id') &&
      typeof value === 'string'
    ) {
      // Truncate IDs
      compacted[key] = `${value.slice(0, 8)}...`;
    } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 5) {
      // Compress large objects
      compacted[key] = `<object with ${Object.keys(value).length} keys>`;
    } else {
      compacted[key] = value;
    }
  }

  return compacted;
}

/**
 * Logger middleware for compact output
 *
 * Usage:
 *   const logger = createLogger({ middleware: createCompactMiddleware() });
 */
export function createCompactMiddleware(opts: CompactLogOptions = {}) {
  return (log: Record<string, unknown>) => {
    return compactLog(log, opts);
  };
}
