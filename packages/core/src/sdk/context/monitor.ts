/**
 * Context Monitoring
 *
 * Token estimation and context usage tracking
 */

import type { SDKAnyMessage, SDKTool } from '../types.js';
import type { ContextConfig, ContextMetrics } from './types.js';

/**
 * Estimate token count for a string
 *
 * Uses character-based estimation (~4 chars per token for English)
 * This is a rough estimate; actual tokenization varies by model
 */
export function estimateTokens(content: string): number {
  if (!content) {
    return 0;
  }
  // ~4 characters per token for English text
  // Add small overhead for special tokens
  return Math.ceil(content.length / 4) + 1;
}

/**
 * Estimate tokens for a message
 */
export function estimateMessageTokens(message: SDKAnyMessage): number {
  let tokens = 0;

  // Message content
  if (message.content) {
    tokens += estimateTokens(message.content);
  }

  // Role overhead (~4 tokens)
  tokens += 4;

  // Metadata if present
  if (message.metadata) {
    tokens += estimateTokens(JSON.stringify(message.metadata));
  }

  return tokens;
}

/**
 * Estimate tokens for tool definitions
 */
export function estimateToolTokens(tools: SDKTool[]): number {
  if (!tools || tools.length === 0) {
    return 0;
  }

  let tokens = 0;
  for (const tool of tools) {
    // Tool name and description
    tokens += estimateTokens(tool.name);
    tokens += estimateTokens(tool.description);

    // Schema (rough estimate)
    if (tool.inputSchema) {
      tokens += estimateTokens(JSON.stringify(tool.inputSchema));
    }
  }

  return tokens;
}

/**
 * Monitor context usage and calculate metrics
 */
export function monitorContext(
  messages: SDKAnyMessage[],
  systemPrompt: string,
  tools: SDKTool[],
  config: Partial<ContextConfig>
): ContextMetrics {
  const maxTokens = config.maxTokens || 200000;

  // Calculate breakdown
  const systemPromptTokens = estimateTokens(systemPrompt);
  const toolsTokens = estimateToolTokens(tools);

  let historyTokens = 0;
  let toolResultCount = 0;

  for (const message of messages) {
    historyTokens += estimateMessageTokens(message);
    if (message.type === 'tool_result') {
      toolResultCount++;
    }
  }

  const totalTokens = systemPromptTokens + toolsTokens + historyTokens;
  const utilization = totalTokens / maxTokens;

  return {
    totalTokens,
    utilization,
    breakdown: {
      systemPrompt: systemPromptTokens,
      tools: toolsTokens,
      history: historyTokens,
      retrieved: 0, // Will be updated when RAG is implemented
    },
    messageCount: messages.length,
    toolResultCount,
  };
}

/**
 * Check if context needs compaction
 */
export function needsCompaction(metrics: ContextMetrics, threshold: number): boolean {
  return metrics.utilization >= threshold;
}

/**
 * Get context status for logging/display
 */
export function getContextStatus(metrics: ContextMetrics): {
  status: 'green' | 'yellow' | 'red';
  message: string;
} {
  if (metrics.utilization < 0.75) {
    return {
      status: 'green',
      message: `Context: ${(metrics.utilization * 100).toFixed(1)}% (${metrics.totalTokens} tokens)`,
    };
  }

  if (metrics.utilization < 0.85) {
    return {
      status: 'yellow',
      message: `Context: ${(metrics.utilization * 100).toFixed(1)}% - approaching limit`,
    };
  }

  return {
    status: 'red',
    message: `Context: ${(metrics.utilization * 100).toFixed(1)}% - compaction recommended`,
  };
}
