/**
 * Context Compaction
 *
 * Summarization and compression of conversation history
 */

import type { SDKAnyMessage } from '../types.js';
import { estimateTokens, monitorContext } from './monitor.js';
import { applyPruning } from './pruning.js';
import type {
  CompactedContext,
  ContextConfig,
  ContextMetrics,
  PersistFn,
  SummarizerFn,
} from './types.js';
import { createContextConfig } from './types.js';

/**
 * Format messages for summarization
 */
function formatMessagesForSummary(messages: SDKAnyMessage[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    switch (msg.type) {
      case 'user':
        parts.push(`User: ${msg.content}`);
        break;
      case 'assistant':
        parts.push(`Assistant: ${msg.content}`);
        break;
      case 'tool_use':
        parts.push(`Tool call: ${(msg as any).toolName}`);
        break;
      case 'tool_result':
        // Skip cleared results
        if (msg.metadata?.cleared) {
          continue;
        }
        parts.push(`Tool result: ${msg.content?.slice(0, 200)}...`);
        break;
      case 'system':
        // Include important system messages
        if (msg.content && !msg.content.includes('contextMetrics')) {
          parts.push(`System: ${msg.content}`);
        }
        break;
    }
  }

  return parts.join('\n');
}

/**
 * Default summarizer using simple extraction
 *
 * Extracts key information without LLM call.
 * For production, replace with AI Gateway call.
 */
export function createDefaultSummarizer(): SummarizerFn {
  return async (content: string): Promise<string> => {
    const lines = content.split('\n');
    const summary: string[] = [];

    // Extract key decisions and findings
    const patterns = {
      decisions: /decided|chose|selected|will use|implemented/i,
      findings: /found|discovered|identified|detected|error|bug|issue/i,
      actions: /created|updated|modified|deleted|added|removed|fixed/i,
    };

    for (const line of lines) {
      if (patterns.decisions.test(line)) {
        summary.push(`Decision: ${line.slice(0, 200)}`);
      } else if (patterns.findings.test(line)) {
        summary.push(`Finding: ${line.slice(0, 200)}`);
      } else if (patterns.actions.test(line)) {
        summary.push(`Action: ${line.slice(0, 200)}`);
      }
    }

    // Limit summary size
    if (summary.length > 20) {
      return summary.slice(-20).join('\n');
    }

    if (summary.length === 0) {
      // Fallback: take last few exchanges
      return lines.slice(-10).join('\n');
    }

    return summary.join('\n');
  };
}

/**
 * Create a summarizer using AI Gateway
 *
 * Makes a simple LLM call to summarize the conversation
 */
export function createAIGatewaySummarizer(
  gatewayFetch: (prompt: string) => Promise<string>
): SummarizerFn {
  return async (content: string): Promise<string> => {
    const prompt = `Summarize this conversation history concisely. Focus on:
- Key decisions made
- Important findings or errors
- Actions taken
- Current task state

Keep the summary under 500 words.

Conversation:
${content}

Summary:`;

    try {
      const summary = await gatewayFetch(prompt);
      return summary;
    } catch (error) {
      // Fallback to simple extraction on error
      console.error('AI Gateway summarization failed, using fallback:', error);
      const fallback = createDefaultSummarizer();
      return fallback(content);
    }
  };
}

/**
 * Compact context when approaching limits
 *
 * Strategy:
 * 1. Prune tool results (lowest risk)
 * 2. Summarize older messages if still over threshold
 * 3. Persist to memory if enabled
 */
export async function compactContext(
  messages: SDKAnyMessage[],
  config: Partial<ContextConfig>,
  options?: {
    summarizer?: SummarizerFn;
    persist?: PersistFn;
    sessionId?: string;
    systemPrompt?: string;
  }
): Promise<CompactedContext> {
  const fullConfig = createContextConfig(config);
  const { summarizer, persist, sessionId, systemPrompt = '' } = options || {};

  // Calculate initial metrics
  const initialMetrics = monitorContext(messages, systemPrompt, [], fullConfig);

  // Check if compaction is needed
  if (initialMetrics.utilization < fullConfig.compactionThreshold) {
    return {
      summary: '',
      recentMessages: messages,
      wasCompacted: false,
      metrics: initialMetrics,
    };
  }

  // Step 1: Apply pruning strategies
  const { messages: pruned, stats } = applyPruning(messages, {
    turnThreshold: fullConfig.pruneToolResultsAfter,
    maxResultLength: fullConfig.maxToolResultLength,
  });

  // Check if pruning was sufficient
  const prunedMetrics = monitorContext(pruned, systemPrompt, [], fullConfig);

  if (prunedMetrics.utilization < fullConfig.compactionThreshold) {
    return {
      summary: '',
      recentMessages: pruned,
      wasCompacted: true,
      metrics: prunedMetrics,
      pruningStats: {
        toolResultsCleared: stats.toolResultsCleared,
        toolResultsTruncated: stats.toolResultsTruncated,
        messagesRemoved: stats.systemMessagesRemoved,
      },
    };
  }

  // Step 2: Summarize older messages
  const preserveCount = fullConfig.preserveRecentMessages;
  const recentMessages = pruned.slice(-preserveCount);
  const toSummarize = pruned.slice(0, -preserveCount);

  // Generate summary
  const summarizeFn = summarizer || createDefaultSummarizer();
  const formattedContent = formatMessagesForSummary(toSummarize);
  const summary = await summarizeFn(formattedContent);

  // Calculate final metrics (estimate summary tokens)
  const summaryTokens = estimateTokens(summary);
  const recentTokens = recentMessages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content || ''),
    0
  );

  const finalMetrics: ContextMetrics = {
    totalTokens: summaryTokens + recentTokens,
    utilization: (summaryTokens + recentTokens) / fullConfig.maxTokens,
    breakdown: {
      systemPrompt: estimateTokens(systemPrompt),
      tools: 0,
      history: recentTokens,
      retrieved: summaryTokens,
    },
    messageCount: recentMessages.length,
    toolResultCount: recentMessages.filter((m) => m.type === 'tool_result').length,
  };

  // Step 3: Persist to memory if enabled
  if (fullConfig.persistOnCompaction && persist && sessionId) {
    try {
      await persist(sessionId, summary, finalMetrics);
    } catch (error) {
      console.error('Failed to persist compacted context:', error);
    }
  }

  return {
    summary,
    recentMessages,
    wasCompacted: true,
    metrics: finalMetrics,
    pruningStats: {
      toolResultsCleared: stats.toolResultsCleared,
      toolResultsTruncated: stats.toolResultsTruncated,
      messagesRemoved: toSummarize.length,
    },
  };
}

/**
 * Create a context manager for continuous monitoring and compaction
 */
export function createContextManager(config: Partial<ContextConfig>) {
  const fullConfig = createContextConfig(config);
  const messages: SDKAnyMessage[] = [];
  let currentSummary = '';

  return {
    /**
     * Add a message to the context
     */
    addMessage(message: SDKAnyMessage) {
      messages.push(message);
    },

    /**
     * Get current metrics
     */
    getMetrics(systemPrompt = ''): ContextMetrics {
      return monitorContext(messages, systemPrompt, [], fullConfig);
    },

    /**
     * Check if compaction is needed
     */
    needsCompaction(systemPrompt = ''): boolean {
      const metrics = this.getMetrics(systemPrompt);
      return metrics.utilization >= fullConfig.compactionThreshold;
    },

    /**
     * Perform compaction
     */
    async compact(options?: {
      summarizer?: SummarizerFn;
      persist?: PersistFn;
      sessionId?: string;
      systemPrompt?: string;
    }): Promise<CompactedContext> {
      const result = await compactContext(messages, fullConfig, options);

      if (result.wasCompacted) {
        // Update internal state
        messages.length = 0;
        messages.push(...result.recentMessages);
        currentSummary = result.summary;
      }

      return result;
    },

    /**
     * Get current summary (from last compaction)
     */
    getSummary(): string {
      return currentSummary;
    },

    /**
     * Get all messages
     */
    getMessages(): SDKAnyMessage[] {
      return [...messages];
    },

    /**
     * Clear all messages
     */
    clear() {
      messages.length = 0;
      currentSummary = '';
    },
  };
}
