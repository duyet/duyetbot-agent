/**
 * Context Pruning
 *
 * Strategies for reducing context size by clearing or truncating old content
 */

import type { SDKAnyMessage, SDKToolResultMessage } from '../types.js';

/**
 * Prune old tool results from message history
 *
 * Clears content of tool results that are older than the specified turn threshold
 */
export function pruneToolResults(
  messages: SDKAnyMessage[],
  turnThreshold: number
): { messages: SDKAnyMessage[]; cleared: number } {
  const currentTurn = messages.length;
  let cleared = 0;

  const pruned = messages.map((msg, index) => {
    if (msg.type !== 'tool_result') {
      return msg;
    }

    const age = currentTurn - index;
    if (age > turnThreshold) {
      cleared++;
      return {
        ...msg,
        content: '[Result cleared - aged out]',
        metadata: {
          ...(msg.metadata || {}),
          cleared: true,
          originalLength: msg.content?.length || 0,
        },
      } as SDKToolResultMessage;
    }

    return msg;
  });

  return { messages: pruned, cleared };
}

/**
 * Truncate verbose tool results
 *
 * Shortens tool results that exceed the maximum length
 */
export function truncateToolResults(
  messages: SDKAnyMessage[],
  maxLength: number
): { messages: SDKAnyMessage[]; truncated: number } {
  let truncated = 0;

  const processed = messages.map((msg) => {
    if (msg.type !== 'tool_result') {
      return msg;
    }
    if (!msg.content || msg.content.length <= maxLength) {
      return msg;
    }

    truncated++;
    const truncatedContent = `${msg.content.slice(0, maxLength)}\n...[Truncated]`;

    return {
      ...msg,
      content: truncatedContent,
      metadata: {
        ...(msg.metadata || {}),
        truncated: true,
        originalLength: msg.content.length,
      },
    } as SDKToolResultMessage;
  });

  return { messages: processed, truncated };
}

/**
 * Remove redundant system messages
 *
 * Keeps only the most recent system message of each type
 */
export function deduplicateSystemMessages(messages: SDKAnyMessage[]): SDKAnyMessage[] {
  const seenTypes = new Set<string>();
  const result: SDKAnyMessage[] = [];

  // Process in reverse to keep most recent
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) {
      continue;
    }

    if (msg.type !== 'system') {
      result.unshift(msg);
      continue;
    }

    // Extract system message type from content if possible
    let msgType = 'default';
    try {
      const parsed = JSON.parse(msg.content || '{}');
      msgType = Object.keys(parsed)[0] || 'default';
    } catch {
      // Not JSON, use default type
    }

    if (!seenTypes.has(msgType)) {
      seenTypes.add(msgType);
      result.unshift(msg);
    }
  }

  return result;
}

/**
 * Apply all pruning strategies
 */
export function applyPruning(
  messages: SDKAnyMessage[],
  options: {
    turnThreshold: number;
    maxResultLength: number;
    deduplicateSystem?: boolean;
  }
): {
  messages: SDKAnyMessage[];
  stats: {
    toolResultsCleared: number;
    toolResultsTruncated: number;
    systemMessagesRemoved: number;
  };
} {
  // 1. Truncate verbose results first (preserves some info)
  const { messages: truncated, truncated: truncatedCount } = truncateToolResults(
    messages,
    options.maxResultLength
  );

  // 2. Clear old results (more aggressive)
  const { messages: pruned, cleared: clearedCount } = pruneToolResults(
    truncated,
    options.turnThreshold
  );

  // 3. Deduplicate system messages if enabled
  let final = pruned;
  let systemRemoved = 0;

  if (options.deduplicateSystem !== false) {
    final = deduplicateSystemMessages(pruned);
    systemRemoved = pruned.length - final.length;
  }

  return {
    messages: final,
    stats: {
      toolResultsCleared: clearedCount,
      toolResultsTruncated: truncatedCount,
      systemMessagesRemoved: systemRemoved,
    },
  };
}
