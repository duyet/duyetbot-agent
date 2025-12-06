/**
 * Scratchpad Tool
 *
 * Short-term memory for agent task execution.
 * Stores notes, intermediate results, and cross-step context within a session.
 */
import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';
interface ScratchpadEntry {
  content: string;
  timestamp: number;
  size: number;
  tags?: string[];
}
/**
 * Scratchpad tool implementation
 */
export declare class ScratchpadTool implements Tool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<
    {
      action: z.ZodEnum<['save', 'get', 'list', 'clear', 'delete']>;
      key: z.ZodOptional<z.ZodString>;
      content: z.ZodOptional<z.ZodString>;
      sessionId: z.ZodOptional<z.ZodString>;
    },
    'strip',
    z.ZodTypeAny,
    {
      action: 'get' | 'delete' | 'clear' | 'list' | 'save';
      sessionId?: string | undefined;
      content?: string | undefined;
      key?: string | undefined;
    },
    {
      action: 'get' | 'delete' | 'clear' | 'list' | 'save';
      sessionId?: string | undefined;
      content?: string | undefined;
      key?: string | undefined;
    }
  >;
  /**
   * Validate input
   */
  validate(input: ToolInput): boolean;
  /**
   * Execute scratchpad operation
   */
  execute(input: ToolInput): Promise<ToolOutput>;
}
/**
 * Create and export singleton instance
 */
export declare const scratchpadTool: ScratchpadTool;
/**
 * Utility: Get all notes for a session (for external use)
 */
export declare function getSessionNotes(
  sessionId: string
): Map<string, ScratchpadEntry> | undefined;
/**
 * Utility: Clear all scratchpads (for testing)
 */
export declare function clearAllScratchpads(): void;
/**
 * Utility: Get scratchpad stats
 */
export declare function getScratchpadStats(): {
  sessionCount: number;
  totalNotes: number;
  totalSize: number;
};
//# sourceMappingURL=scratchpad.d.ts.map
