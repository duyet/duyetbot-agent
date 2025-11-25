/**
 * Scratchpad Tool
 *
 * Short-term memory for agent task execution.
 * Stores notes, intermediate results, and cross-step context within a session.
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { ToolExecutionError } from '@duyetbot/types';
import { z } from 'zod';

// Input schema for scratchpad tool
const scratchpadInputSchema = z.object({
  action: z.enum(['save', 'get', 'list', 'clear', 'delete']).describe('Operation to perform'),
  key: z.string().optional().describe('Note identifier (required for save/get/delete)'),
  content: z.string().optional().describe('Content to save'),
  sessionId: z.string().optional().describe('Session identifier (auto-generated if not provided)'),
});

// In-memory storage for scratchpads
// Map<sessionId, Map<key, { content, timestamp, tags }>>
const scratchpads = new Map<string, Map<string, ScratchpadEntry>>();

interface ScratchpadEntry {
  content: string;
  timestamp: number;
  size: number;
  tags?: string[];
}

/**
 * Scratchpad tool implementation
 */
export class ScratchpadTool implements Tool {
  name = 'scratchpad';
  description = `Save/retrieve temporary notes during task execution. Use for:
- Planning and task breakdown
- Intermediate results and findings
- Cross-step context preservation
- Error logs and recovery information
Notes are stored in memory and cleared when the session ends.`;
  inputSchema = scratchpadInputSchema;

  /**
   * Validate input
   */
  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    if (!result.success) {
      return false;
    }

    const { action, key, content } = result.data;

    // Validate required fields per action
    if (action === 'save' && (!key || !content)) {
      return false;
    }
    if (action === 'get' && !key) {
      return false;
    }
    if (action === 'delete' && !key) {
      return false;
    }

    return true;
  }

  /**
   * Execute scratchpad operation
   */
  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: `Invalid input: ${parsed.error.message}`,
            code: 'INVALID_INPUT',
          },
        };
      }

      const { action, key, content } = parsed.data;
      // Use sessionId from input or metadata, default to 'default'
      const sessionId = parsed.data.sessionId || (input.metadata?.sessionId as string) || 'default';

      // Ensure session scratchpad exists
      if (!scratchpads.has(sessionId)) {
        scratchpads.set(sessionId, new Map());
      }
      const pad = scratchpads.get(sessionId)!;

      switch (action) {
        case 'save': {
          if (!key || !content) {
            return {
              status: 'error',
              content: 'Key and content are required for save',
              error: {
                message: 'Missing required fields: key and content',
                code: 'MISSING_FIELDS',
              },
            };
          }

          pad.set(key, {
            content,
            timestamp: Date.now(),
            size: content.length,
          });

          return {
            status: 'success',
            content: `Saved note "${key}" (${content.length} chars)`,
            metadata: {
              key,
              size: content.length,
              sessionId,
              totalNotes: pad.size,
            },
          };
        }

        case 'get': {
          if (!key) {
            return {
              status: 'error',
              content: 'Key is required for get',
              error: {
                message: 'Missing required field: key',
                code: 'MISSING_KEY',
              },
            };
          }

          const entry = pad.get(key);
          if (!entry) {
            return {
              status: 'error',
              content: `Note "${key}" not found`,
              error: {
                message: `No note found with key: ${key}`,
                code: 'NOT_FOUND',
              },
            };
          }

          return {
            status: 'success',
            content: entry.content,
            metadata: {
              key,
              size: entry.size,
              timestamp: entry.timestamp,
              age: Date.now() - entry.timestamp,
            },
          };
        }

        case 'list': {
          const entries = Array.from(pad.entries()).map(([k, v]) => ({
            key: k,
            size: v.size,
            age: Date.now() - v.timestamp,
            timestamp: v.timestamp,
          }));

          return {
            status: 'success',
            content:
              entries.length > 0
                ? entries
                    .map((e) => `- ${e.key} (${e.size} chars, ${Math.round(e.age / 1000)}s ago)`)
                    .join('\n')
                : 'No notes in scratchpad',
            metadata: {
              count: entries.length,
              entries,
              sessionId,
            },
          };
        }

        case 'delete': {
          if (!key) {
            return {
              status: 'error',
              content: 'Key is required for delete',
              error: {
                message: 'Missing required field: key',
                code: 'MISSING_KEY',
              },
            };
          }

          const existed = pad.delete(key);
          return {
            status: 'success',
            content: existed ? `Deleted note "${key}"` : `Note "${key}" not found`,
            metadata: {
              key,
              deleted: existed,
              remainingNotes: pad.size,
            },
          };
        }

        case 'clear': {
          const count = pad.size;
          pad.clear();

          return {
            status: 'success',
            content: `Cleared ${count} notes from scratchpad`,
            metadata: {
              cleared: count,
              sessionId,
            },
          };
        }

        default:
          return {
            status: 'error',
            content: `Unknown action: ${action}`,
            error: {
              message: `Invalid action: ${action}`,
              code: 'INVALID_ACTION',
            },
          };
      }
    } catch (error) {
      throw new ToolExecutionError(
        'scratchpad',
        error instanceof Error ? error.message : 'Unknown error',
        'EXECUTION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Create and export singleton instance
 */
export const scratchpadTool = new ScratchpadTool();

/**
 * Utility: Get all notes for a session (for external use)
 */
export function getSessionNotes(sessionId: string): Map<string, ScratchpadEntry> | undefined {
  return scratchpads.get(sessionId);
}

/**
 * Utility: Clear all scratchpads (for testing)
 */
export function clearAllScratchpads(): void {
  scratchpads.clear();
}

/**
 * Utility: Get scratchpad stats
 */
export function getScratchpadStats(): {
  sessionCount: number;
  totalNotes: number;
  totalSize: number;
} {
  let totalNotes = 0;
  let totalSize = 0;

  for (const pad of scratchpads.values()) {
    totalNotes += pad.size;
    for (const entry of pad.values()) {
      totalSize += entry.size;
    }
  }

  return {
    sessionCount: scratchpads.size,
    totalNotes,
    totalSize,
  };
}
