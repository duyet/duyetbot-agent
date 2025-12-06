/**
 * Sleep Tool
 *
 * Delays execution for a specified duration
 */
import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';
/**
 * Sleep tool implementation
 */
export declare class SleepTool implements Tool {
  name: string;
  description: string;
  inputSchema: z.ZodUnion<
    [
      z.ZodEffects<
        z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>,
        {
          duration: number;
        },
        string
      >,
      z.ZodObject<
        {
          duration: z.ZodNumber;
          unit: z.ZodDefault<z.ZodOptional<z.ZodEnum<['milliseconds', 'seconds', 'minutes']>>>;
        },
        'strip',
        z.ZodTypeAny,
        {
          duration: number;
          unit: 'milliseconds' | 'seconds' | 'minutes';
        },
        {
          duration: number;
          unit?: 'milliseconds' | 'seconds' | 'minutes' | undefined;
        }
      >,
    ]
  >;
  /**
   * Validate input
   */
  validate(input: ToolInput): boolean;
  /**
   * Execute sleep
   */
  execute(input: ToolInput): Promise<ToolOutput>;
  /**
   * Sleep for specified duration with optional cancellation
   */
  private sleep;
  /**
   * Convert duration to milliseconds
   */
  private getDurationInMs;
}
/**
 * Create and export singleton instance
 */
export declare const sleepTool: SleepTool;
//# sourceMappingURL=sleep.d.ts.map
