/**
 * Git Tool
 *
 * Executes git operations for version control
 */
import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';
/**
 * Git tool implementation
 */
export declare class GitTool implements Tool {
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
          command: z.ZodEnum<
            [
              'status',
              'clone',
              'commit',
              'push',
              'pull',
              'add',
              'diff',
              'log',
              'branch',
              'checkout',
            ]
          >;
          url: z.ZodOptional<z.ZodString>;
          directory: z.ZodOptional<z.ZodString>;
          depth: z.ZodOptional<z.ZodNumber>;
          message: z.ZodOptional<z.ZodString>;
          amend: z.ZodOptional<z.ZodBoolean>;
          remote: z.ZodOptional<z.ZodString>;
          branch: z.ZodOptional<z.ZodString>;
          force: z.ZodOptional<z.ZodBoolean>;
          rebase: z.ZodOptional<z.ZodBoolean>;
          files: z.ZodOptional<z.ZodArray<z.ZodString, 'many'>>;
          staged: z.ZodOptional<z.ZodBoolean>;
          limit: z.ZodOptional<z.ZodNumber>;
          oneline: z.ZodOptional<z.ZodBoolean>;
          name: z.ZodOptional<z.ZodString>;
          create: z.ZodOptional<z.ZodBoolean>;
          delete: z.ZodOptional<z.ZodBoolean>;
        },
        'strip',
        z.ZodTypeAny,
        {
          command:
            | 'push'
            | 'status'
            | 'clone'
            | 'add'
            | 'diff'
            | 'commit'
            | 'log'
            | 'pull'
            | 'branch'
            | 'checkout';
          name?: string | undefined;
          message?: string | undefined;
          limit?: number | undefined;
          delete?: boolean | undefined;
          url?: string | undefined;
          create?: boolean | undefined;
          branch?: string | undefined;
          directory?: string | undefined;
          depth?: number | undefined;
          amend?: boolean | undefined;
          remote?: string | undefined;
          force?: boolean | undefined;
          rebase?: boolean | undefined;
          files?: string[] | undefined;
          staged?: boolean | undefined;
          oneline?: boolean | undefined;
        },
        {
          command:
            | 'push'
            | 'status'
            | 'clone'
            | 'add'
            | 'diff'
            | 'commit'
            | 'log'
            | 'pull'
            | 'branch'
            | 'checkout';
          name?: string | undefined;
          message?: string | undefined;
          limit?: number | undefined;
          delete?: boolean | undefined;
          url?: string | undefined;
          create?: boolean | undefined;
          branch?: string | undefined;
          directory?: string | undefined;
          depth?: number | undefined;
          amend?: boolean | undefined;
          remote?: string | undefined;
          force?: boolean | undefined;
          rebase?: boolean | undefined;
          files?: string[] | undefined;
          staged?: boolean | undefined;
          oneline?: boolean | undefined;
        }
      >,
    ]
  >;
  /**
   * Validate input
   */
  validate(input: ToolInput): boolean;
  /**
   * Execute git command
   */
  execute(input: ToolInput): Promise<ToolOutput>;
  /**
   * Execute git command
   */
  private execGit;
  /**
   * Build clone command
   */
  private buildCloneCommand;
  /**
   * Build commit command
   */
  private buildCommitCommand;
  /**
   * Build push command
   */
  private buildPushCommand;
  /**
   * Build pull command
   */
  private buildPullCommand;
  /**
   * Build add command
   */
  private buildAddCommand;
  /**
   * Build diff command
   */
  private buildDiffCommand;
  /**
   * Build log command
   */
  private buildLogCommand;
  /**
   * Build branch command
   */
  private buildBranchCommand;
  /**
   * Build checkout command
   */
  private buildCheckoutCommand;
  /**
   * Handle status output
   */
  private handleStatus;
  /**
   * Handle branch output
   */
  private handleBranch;
  /**
   * Create success response
   */
  private success;
  /**
   * Create error response
   */
  private error;
}
/**
 * Create and export singleton instance
 */
export declare const gitTool: GitTool;
//# sourceMappingURL=git.d.ts.map
