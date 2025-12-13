/**
 * Memory Context Helper
 *
 * Provides utilities for loading, formatting, and saving memory context
 * within agent execution flows.
 */

import type {
  ExecutionContext,
  LongTermMemoryItem,
  PreloadedMemoryContext,
} from '../execution/index.js';
import type { MemoryAdapter } from '../memory-adapter.js';

/**
 * Load relevant memory context at agent start
 *
 * Fetches short-term memory for the current session and relevant long-term memory
 * based on the user's query. Populates the memoryContext field in ExecutionContext.
 *
 * @param ctx - ExecutionContext to populate with memory
 * @param memoryAdapter - Memory adapter for fetching data
 * @param sessionId - Session ID for short-term memory lookup
 * @returns Updated ExecutionContext with memoryContext populated
 *
 * @example
 * ```typescript
 * const ctx = createExecutionContext(...);
 * const updatedCtx = await loadMemoryContext(ctx, memoryAdapter, sessionId);
 * // Now ctx.memoryContext contains relevant memory
 * ```
 */
export async function loadMemoryContext(
  ctx: ExecutionContext,
  memoryAdapter: MemoryAdapter,
  sessionId: string
): Promise<ExecutionContext> {
  const shortTermItems = [];
  const relevantLongTerm: LongTermMemoryItem[] = [];
  const userPreferences: Record<string, string> = {};

  try {
    // Load short-term memory for this session
    if (memoryAdapter.listShortTermMemory) {
      const shortTermEntries = await memoryAdapter.listShortTermMemory(sessionId);

      shortTermItems.push(
        ...shortTermEntries
          .filter((item) => item.expiresAt > Date.now())
          .map((item) => ({
            key: item.key,
            value: item.value,
            expiresAt: item.expiresAt,
          }))
      );
    }

    // Load relevant long-term memory based on query and context
    if (memoryAdapter.searchMemoryByQuery) {
      // TODO: Implement semantic search results integration
      // const searchResults = await memoryAdapter.searchMemoryByQuery(ctx.query, {
      //   limit: 5,
      // });
      // Note: searchResults format differs from getLongTermMemory
      // We'll attempt to load user preferences separately
    }

    // Load user preferences from long-term memory
    if (memoryAdapter.getLongTermMemory) {
      const preferences = await memoryAdapter.getLongTermMemory({
        category: 'preference',
        limit: 10,
      });

      for (const pref of preferences) {
        userPreferences[pref.key] = pref.value;
        relevantLongTerm.push(pref);
      }

      // Also load recent facts
      const facts = await memoryAdapter.getLongTermMemory({
        category: 'fact',
        limit: 5,
      });

      for (const fact of facts) {
        if (relevantLongTerm.length < 10) {
          relevantLongTerm.push(fact);
        }
      }
    }
  } catch (error) {
    console.warn('[MemoryContextHelper] Failed to load memory context:', error);
    // Continue with empty memory - graceful degradation
  }

  return {
    ...ctx,
    memoryContext: {
      shortTermItems,
      relevantLongTerm,
      userPreferences,
    },
  };
}

/**
 * Format memory context for inclusion in system prompt
 *
 * Converts loaded memory into a formatted string suitable for inclusion
 * in the LLM system prompt.
 *
 * @param memoryContext - Preloaded memory context
 * @returns Formatted memory context string, or empty string if no context
 *
 * @example
 * ```typescript
 * const memorySection = formatMemoryContextForPrompt(ctx.memoryContext);
 * const systemPrompt = `You are a helpful assistant.\n\n${memorySection}`;
 * ```
 */
export function formatMemoryContextForPrompt(
  memoryContext: PreloadedMemoryContext | undefined
): string {
  if (!memoryContext) {
    return '';
  }

  const sections: string[] = [];

  // User preferences section
  if (Object.keys(memoryContext.userPreferences).length > 0) {
    const preferencesStr = Object.entries(memoryContext.userPreferences)
      .map(([key, value]) => `  - ${key}: ${value}`)
      .join('\n');

    sections.push(`User Preferences:\n${preferencesStr}`);
  }

  // Relevant memories section
  if (memoryContext.relevantLongTerm.length > 0) {
    const memoriesStr = memoryContext.relevantLongTerm
      .map((item) => {
        const category = item.category.charAt(0).toUpperCase() + item.category.slice(1);
        return `  - [${category}] ${item.key}: ${item.value}`;
      })
      .join('\n');

    sections.push(`Relevant Memory:\n${memoriesStr}`);
  }

  // Session context section
  if (memoryContext.shortTermItems.length > 0) {
    const sessionStr = memoryContext.shortTermItems
      .map((item) => `  - ${item.key}: ${item.value}`)
      .join('\n');

    sections.push(`Session Context:\n${sessionStr}`);
  }

  return sections.length > 0 ? `<memory_context>\n${sections.join('\n\n')}\n</memory_context>` : '';
}

/**
 * Auto-save important facts at end of conversation
 *
 * Analyzes the conversation to identify and save important facts that should
 * be retained in long-term memory. This is useful for learning user preferences
 * and important information over time.
 *
 * @param ctx - ExecutionContext containing conversation history
 * @param memoryAdapter - Memory adapter for saving data
 * @param importance - Importance score 1-10 (default: 5)
 *
 * @example
 * ```typescript
 * // At the end of agent execution
 * await autoSaveFacts(ctx, memoryAdapter, 6);
 * ```
 */
export async function autoSaveFacts(
  ctx: ExecutionContext,
  memoryAdapter: MemoryAdapter,
  importance: number = 5
): Promise<void> {
  if (!memoryAdapter.saveLongTermMemory) {
    return;
  }

  try {
    // Extract facts from assistant responses
    // Look for patterns like "I remember...", "You mentioned...", "Your preference is..."
    const facts: Array<{ category: string; key: string; value: string }> = [];

    for (const message of ctx.conversationHistory) {
      if (message.role === 'assistant') {
        // Simple heuristic: extract sentences that mention preferences or facts
        const sentences = message.content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

        for (const sentence of sentences) {
          if (
            sentence.toLowerCase().includes('preference') ||
            sentence.toLowerCase().includes('like') ||
            sentence.toLowerCase().includes('prefer')
          ) {
            facts.push({
              category: 'preference',
              key: `pref_${Date.now()}`,
              value: sentence.trim(),
            });
          } else if (
            sentence.toLowerCase().includes('important') ||
            sentence.toLowerCase().includes('remember')
          ) {
            facts.push({
              category: 'fact',
              key: `fact_${Date.now()}`,
              value: sentence.trim(),
            });
          }
        }
      }
    }

    // Save extracted facts (with deduplication)
    const savedKeys = new Set<string>();

    for (const fact of facts) {
      const key = `${fact.category}_${fact.value.substring(0, 30).toLowerCase()}`;

      if (!savedKeys.has(key)) {
        try {
          await memoryAdapter.saveLongTermMemory(
            fact.category as 'fact' | 'preference' | 'pattern' | 'decision' | 'note',
            key,
            fact.value,
            importance
          );

          savedKeys.add(key);
        } catch (error) {
          console.warn('[MemoryContextHelper] Failed to save fact:', error);
          // Continue with next fact
        }
      }
    }
  } catch (error) {
    console.warn('[MemoryContextHelper] Failed to auto-save facts:', error);
    // Non-critical operation - don't throw
  }
}

/**
 * Save conversation summary at session end
 *
 * Saves a high-level summary of the conversation for future reference.
 * Useful for tracking completed tasks and outcomes.
 *
 * @param ctx - ExecutionContext containing conversation
 * @param memoryAdapter - Memory adapter for saving data
 * @param summary - Summary of the conversation or outcome
 *
 * @example
 * ```typescript
 * await saveSessionSummary(ctx, memoryAdapter, 'Completed task X, learned about Y');
 * ```
 */
export async function saveSessionSummary(
  _ctx: ExecutionContext,
  memoryAdapter: MemoryAdapter,
  summary: string
): Promise<void> {
  if (!memoryAdapter.saveLongTermMemory) {
    return;
  }

  try {
    const key = `session_${new Date().toISOString().split('T')[0]}`;

    await memoryAdapter.saveLongTermMemory('fact', key, summary, 6);
  } catch (error) {
    console.warn('[MemoryContextHelper] Failed to save session summary:', error);
    // Non-critical operation - don't throw
  }
}
