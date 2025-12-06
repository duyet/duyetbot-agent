/**
 * Bash Tool
 *
 * Executes shell commands in a sandboxed environment
 */
import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';
/**
 * Bash tool implementation
 */
export declare class BashTool implements Tool {
  name: string;
  description: string;
  inputSchema: z.ZodUnion<
    [
      z.ZodEffects<
        z.ZodString,
        {
          command: string;
        },
        string
      >,
      z.ZodObject<
        {
          command: z.ZodString;
          timeout: z.ZodOptional<z.ZodNumber>;
          cwd: z.ZodOptional<z.ZodString>;
          env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        },
        'strip',
        z.ZodTypeAny,
        {
          command: string;
          timeout?: number | undefined;
          env?: Record<string, string> | undefined;
          cwd?: string | undefined;
        },
        {
          command: string;
          timeout?: number | undefined;
          env?: Record<string, string> | undefined;
          cwd?: string | undefined;
        }
      >,
    ]
  >;
  /**
   * Validate input
   */
  validate(input: ToolInput): boolean;
  /**
   * Execute bash command
   */
  execute(input: ToolInput): Promise<ToolOutput>;
}
/**
 * Create and export singleton instance
 */
export declare const bashTool: BashTool;
//# sourceMappingURL=bash.d.ts.map
