import { z } from 'zod';
import type { Settings } from './github/context.js';

export const configSchema = z.object({
  // API key for LLM access (OpenRouter via Anthropic-compatible API)
  // Handle empty string as validation error with clear message
  apiKey: z
    .string()
    .min(1, 'DUYETBOT_API_KEY is required. Set it in GitHub Secrets.')
    .refine((val) => val.trim().length > 0, 'DUYETBOT_API_KEY cannot be empty'),

  // GitHub token for API operations
  githubToken: z.string().min(1),

  // Memory MCP URL (optional)
  // Handle empty string as undefined for cases where GitHub Secret is not set
  memoryMcpUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),

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

/**
 * Load configuration from environment variables with optional settings override
 *
 * Supports both new (DUYETBOT_*) and legacy (ANTHROPIC_*, OPENROUTER_*) names
 * for backward compatibility. Settings object takes precedence over env vars.
 *
 * @param settings Optional settings object from action inputs
 */
export function loadConfig(settings?: Settings): Config {
  // Parse settings object if provided
  const settingsData = settings ? parseSettings(settings) : {};

  const config = configSchema.parse({
    // Support both new and old environment variable names for backward compatibility
    // DUYETBOT_API_KEY takes precedence over legacy names
    apiKey:
      process.env.DUYETBOT_API_KEY ||
      settingsData.model?.apiKey ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      '',
    githubToken: process.env.GITHUB_TOKEN,
    memoryMcpUrl: settingsData.memoryMcpUrl || process.env.MEMORY_MCP_URL,
    model: settingsData.model || process.env.MODEL || process.env.DUYETBOT_MODEL,
    dryRun: settingsData.dryRun ?? process.env.DRY_RUN === 'true',
    taskSources: settingsData.taskSources,
    autoMerge:
      settingsData.autoMerge ??
      (process.env.AUTO_MERGE === 'true'
        ? {
            enabled: true,
            requireChecks: (process.env.REQUIRED_CHECKS || '').split(',').filter(Boolean),
            waitForChecks: process.env.WAIT_FOR_CHECKS !== 'false',
            timeout: parseInt(process.env.AUTO_MERGE_TIMEOUT || '600000', 10),
            approveFirst: process.env.AUTO_MERGE_APPROVE !== 'false',
            deleteBranch: process.env.AUTO_MERGE_DELETE_BRANCH !== 'false',
            closeIssueAfterMerge: process.env.CLOSE_ISSUES_AFTER_MERGE !== 'false',
          }
        : undefined),
    selfImprovement: {
      enableVerification: process.env.ENABLE_VERIFICATION !== 'false',
      enableAutoFix: process.env.ENABLE_AUTO_FIX === 'true',
      maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS || '3', 10),
    },
    continuous:
      settingsData.continuous ??
      (process.env.CONTINUOUS_MODE === 'true'
        ? {
            enabled: true,
            maxTasks: parseInt(process.env.CONTINUOUS_MAX_TASKS || '100', 10),
            delayBetweenTasks: parseInt(process.env.CONTINUOUS_DELAY_MS || '5000', 10),
            closeIssuesAfterMerge: process.env.CLOSE_ISSUES_AFTER_MERGE !== 'false',
            stopOnFirstFailure: process.env.STOP_ON_FIRST_FAILURE === 'true',
          }
        : undefined),
    repository: process.env.GITHUB_REPOSITORY
      ? {
          owner: process.env.GITHUB_REPOSITORY.split('/')[0],
          name: process.env.GITHUB_REPOSITORY.split('/')[1],
        }
      : undefined,
  });

  // Set up SDK environment variables if not already set
  // The Claude Agent SDK reads ANTHROPIC_* variables directly
  if (!process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = config.apiKey;
  }

  if (!process.env.ANTHROPIC_BASE_URL) {
    const baseUrl =
      settingsData.provider?.baseUrl ||
      process.env.DUYETBOT_BASE_URL ||
      'https://openrouter.ai/api';
    process.env.ANTHROPIC_BASE_URL = baseUrl;
  }

  // Only set model defaults if not using a custom model
  if (
    !process.env.ANTHROPIC_DEFAULT_SONNET_MODEL &&
    !process.env.MODEL &&
    !process.env.DUYETBOT_MODEL &&
    !settings?.model
  ) {
    const defaultModel = process.env.DUYETBOT_MODEL || '@preset/claude-code-github-action';
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = defaultModel;
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = defaultModel;
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = defaultModel;
  }

  return config;
}

/**
 * Parse settings object into config-compatible format
 */
function parseSettings(settings: Settings) {
  const parsed: any = {};

  // Memory MCP URL
  if (settings.memoryMcp?.url) {
    parsed.memoryMcpUrl = settings.memoryMcp.url;
  }

  // Model
  if (settings.model) {
    parsed.model = settings.model;
  }

  // Task sources
  if (settings.taskSources) {
    parsed.taskSources = settings.taskSources;
  }

  // Dry run
  if (settings.dryRun !== undefined) {
    parsed.dryRun = settings.dryRun;
  }

  // Auto-merge configuration
  if (settings.autoMerge) {
    parsed.autoMerge = {
      enabled: settings.autoMerge.enabled,
      requireChecks: settings.autoMerge.requiredChecks || [],
      waitForChecks: true,
      timeout: settings.autoMerge.timeout || 600000,
      approveFirst: settings.autoMerge.approve ?? true,
      deleteBranch: settings.autoMerge.deleteBranch ?? true,
      closeIssueAfterMerge: settings.autoMerge.closeIssueAfterMerge ?? false,
    };
  }

  // Continuous mode configuration
  if (settings.continuous) {
    parsed.continuous = {
      enabled: settings.continuous.enabled ?? false,
      maxTasks: settings.continuous.maxTasks ?? 100,
      delayBetweenTasks: settings.continuous.delayBetweenTasks ?? 5000,
      closeIssuesAfterMerge: settings.continuous.closeIssuesAfterMerge ?? true,
      stopOnFirstFailure: settings.continuous.stopOnFirstFailure ?? false,
    };
  }

  // Provider configuration
  if (settings.provider?.baseUrl) {
    parsed.provider = {
      baseUrl: settings.provider.baseUrl,
    };
  }

  return parsed;
}
