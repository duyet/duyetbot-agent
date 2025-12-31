import { z } from 'zod';

export const configSchema = z.object({
  // OpenRouter API key for LLM access
  // Handle empty string as validation error with clear message
  openrouterApiKey: z
    .string()
    .min(1, "OPENROUTER_API_KEY is required. Set it in GitHub Secrets.")
    .refine((val) => val.trim().length > 0, "OPENROUTER_API_KEY cannot be empty"),

  // GitHub token for API operations
  githubToken: z.string().min(1),

  // Memory MCP URL (optional)
  // Handle empty string as undefined for cases where GitHub Secret is not set
  memoryMcpUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" ? undefined : val)),

  // Model to use
  model: z.string().default('anthropic/claude-sonnet-4'),

  // Task sources to check
  taskSources: z
    .array(z.enum(['github-issues', 'file', 'memory']))
    .default(['github-issues', 'file', 'memory']),

  // Max iterations per task
  maxIterations: z.number().default(10),

  // Checkpoint directory
  checkpointDir: z.string().default('.agent/checkpoints'),

  // Log directory
  logDir: z.string().default('.agent/logs'),

  // Dry run mode (don't make real changes)
  dryRun: z.boolean().default(false),

  // Auto-merge configuration
  autoMerge: z
    .object({
      enabled: z.boolean().default(false),
      requireChecks: z.array(z.string()).default([]),
      waitForChecks: z.boolean().default(true),
      timeout: z.number().default(600000), // 10 minutes
      approveFirst: z.boolean().default(true),
      deleteBranch: z.boolean().default(true),
      closeIssueAfterMerge: z.boolean().default(false), // Auto-close issue after PR merge
    })
    .optional(),

  // Self-improvement configuration
  selfImprovement: z
    .object({
      enableVerification: z.boolean().default(true),
      enableAutoFix: z.boolean().default(false),
      maxRecoveryAttempts: z.number().default(3),
    })
    .optional(),

  // Continuous mode configuration
  continuous: z
    .object({
      enabled: z.boolean().default(false),
      maxTasks: z.number().default(100), // Maximum tasks to process before stopping
      delayBetweenTasks: z.number().default(5000), // Delay between tasks (ms)
      closeIssuesAfterMerge: z.boolean().default(true), // Auto-close issues after PR merge
      stopOnFirstFailure: z.boolean().default(false), // Stop if a task fails
    })
    .optional(),

  // Repository info
  repository: z
    .object({
      owner: z.string(),
      name: z.string(),
    })
    .optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    githubToken: process.env.GITHUB_TOKEN,
    memoryMcpUrl: process.env.MEMORY_MCP_URL,
    model: process.env.MODEL,
    dryRun: process.env.DRY_RUN === 'true',
    autoMerge:
      process.env.AUTO_MERGE === 'true'
        ? {
            enabled: true,
            requireChecks: (process.env.REQUIRED_CHECKS || '').split(',').filter(Boolean),
            waitForChecks: process.env.WAIT_FOR_CHECKS !== 'false',
            timeout: parseInt(process.env.AUTO_MERGE_TIMEOUT || '600000', 10),
            approveFirst: process.env.AUTO_MERGE_APPROVE !== 'false',
            deleteBranch: process.env.AUTO_MERGE_DELETE_BRANCH !== 'false',
          }
        : undefined,
    selfImprovement: {
      enableVerification: process.env.ENABLE_VERIFICATION !== 'false',
      enableAutoFix: process.env.ENABLE_AUTO_FIX === 'true',
      maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS || '3', 10),
    },
    continuous:
      process.env.CONTINUOUS_MODE === 'true'
        ? {
            enabled: true,
            maxTasks: parseInt(process.env.CONTINUOUS_MAX_TASKS || '100', 10),
            delayBetweenTasks: parseInt(process.env.CONTINUOUS_DELAY_MS || '5000', 10),
            closeIssuesAfterMerge: process.env.CLOSE_ISSUES_AFTER_MERGE !== 'false',
            stopOnFirstFailure: process.env.STOP_ON_FIRST_FAILURE === 'true',
          }
        : undefined,
    repository: process.env.GITHUB_REPOSITORY
      ? {
          owner: process.env.GITHUB_REPOSITORY.split('/')[0],
          name: process.env.GITHUB_REPOSITORY.split('/')[1],
        }
      : undefined,
  });
}
