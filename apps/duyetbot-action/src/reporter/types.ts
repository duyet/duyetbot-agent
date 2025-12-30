/**
 * Reporter types for GitHub Actions agent
 */

/**
 * Context for reporting task results
 */
export interface ReportContext {
  /** Unique task identifier */
  taskId: string;
  /** Source of the task */
  taskSource: 'github-issues' | 'file' | 'memory';
  /** Whether the task completed successfully */
  success: boolean;
  /** Task output/result */
  output: string;
  /** Error message if task failed */
  error?: string | undefined;
  /** Git branch created (if any) */
  branch?: string | undefined;
  /** Pull request URL (if created) */
  prUrl?: string | undefined;
  /** Number of tokens used */
  tokensUsed: number;
  /** Task duration in milliseconds */
  duration: number;
  /** GitHub issue number (if from issue) */
  issueNumber?: number | undefined;
}

/**
 * Reporter interface for posting task results
 */
export interface Reporter {
  /**
   * Report task results
   * @param context - Task execution context
   */
  report(context: ReportContext): Promise<void>;
}
