/**
 * Memory Module
 *
 * Provides memory integration helpers for agent execution including:
 * - Memory context loading and formatting
 * - Automatic fact saving
 * - Session summary management
 */

export {
  autoSaveFacts,
  formatMemoryContextForPrompt,
  loadMemoryContext,
  saveSessionSummary,
} from './context-helper.js';
