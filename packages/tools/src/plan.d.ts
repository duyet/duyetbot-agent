/**
 * Plan Tool
 *
 * Creates structured plans for complex tasks by breaking them down into manageable steps
 */
import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';
/**
 * Plan tool implementation
 */
export declare class PlanTool implements Tool {
  name: string;
  description: string;
  inputSchema: z.ZodUnion<
    [
      z.ZodEffects<
        z.ZodString,
        {
          task: string;
        },
        string
      >,
      z.ZodObject<
        {
          task: z.ZodString;
          context: z.ZodOptional<z.ZodString>;
          constraints: z.ZodOptional<z.ZodArray<z.ZodString, 'many'>>;
        },
        'strip',
        z.ZodTypeAny,
        {
          task: string;
          context?: string | undefined;
          constraints?: string[] | undefined;
        },
        {
          task: string;
          context?: string | undefined;
          constraints?: string[] | undefined;
        }
      >,
    ]
  >;
  /**
   * Validate input
   */
  validate(input: ToolInput): boolean;
  /**
   * Execute planning
   */
  execute(input: ToolInput): Promise<ToolOutput>;
  /**
   * Generate plan steps from task description
   */
  private generateSteps;
  /**
   * Estimate task complexity
   */
  private estimateComplexity;
  /**
   * Format plan as markdown
   */
  private formatPlan;
}
/**
 * Create and export singleton instance
 */
export declare const planTool: PlanTool;
//# sourceMappingURL=plan.d.ts.map
