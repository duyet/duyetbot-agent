/**
 * Config validation schemas
 *
 * Validation schemas for application configuration.
 */

import { z } from 'zod';
import {
  nonEmptyString,
  optionalUrlSchema,
  portSchema,
  positiveIntSchema,
} from '../common/index.js';

/**
 * Task source enum values
 */
export const taskSourceValues = ['github-issues', 'file', 'memory'] as const;

/**
 * LLM provider enum values
 */
export const llmProviderValues = [
  'anthropic',
  'openai',
  'openrouter',
  'ai-gateway',
  'workers-ai',
] as const;

/**
 * Permission mode enum values
 */
export const permissionModeValues = ['default', 'acceptEdits', 'bypassPermissions'] as const;

/**
 * Repository config schema
 */
export const repositoryConfigSchema = z.object({
  owner: nonEmptyString,
  name: nonEmptyString,
});

/**
 * Auto-merge configuration schema
 */
export const autoMergeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  requireChecks: z.array(z.string()).default([]),
  waitForChecks: z.boolean().default(true),
  timeout: z.number().default(600000),
  approveFirst: z.boolean().default(true),
  deleteBranch: z.boolean().default(true),
  closeIssueAfterMerge: z.boolean().default(false),
});

/**
 * Self-improvement configuration schema
 */
export const selfImprovementConfigSchema = z.object({
  enableVerification: z.boolean().default(true),
  enableAutoFix: z.boolean().default(false),
  maxRecoveryAttempts: positiveIntSchema.default(3),
});

/**
 * Continuous mode configuration schema
 */
export const continuousConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxTasks: positiveIntSchema.default(100),
  delayBetweenTasks: z.number().default(5000), // 5 seconds
  closeIssuesAfterMerge: z.boolean().default(true),
  stopOnFirstFailure: z.boolean().default(false),
});

/**
 * Base agent configuration schema
 */
export const agentConfigSchema = z.object({
  // API configuration
  apiKey: nonEmptyString,
  githubToken: nonEmptyString,
  memoryMcpUrl: optionalUrlSchema,

  // Model configuration
  model: z.string().default('anthropic/claude-sonnet-4'),
  provider: z.enum(llmProviderValues).optional(),

  // Task configuration
  taskSources: z.array(z.enum(taskSourceValues)).default([...taskSourceValues]),
  maxIterations: positiveIntSchema.default(10),

  // Directory configuration
  checkpointDir: z.string().default('.agent/checkpoints'),
  logDir: z.string().default('.agent/logs'),

  // Execution mode
  dryRun: z.boolean().default(false),

  // Optional configurations
  autoMerge: autoMergeConfigSchema.optional(),
  selfImprovement: selfImprovementConfigSchema.optional(),
  continuous: continuousConfigSchema.optional(),
  repository: repositoryConfigSchema.optional(),
});

/**
 * Server configuration schema
 */
export const serverConfigSchema = z.object({
  port: portSchema.optional().default(3000),
  host: z.string().default('localhost'),
  cors: z
    .object({
      origin: z.union([z.string(), z.array(z.string()), z.boolean()]).optional(),
      credentials: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Database configuration schema
 */
export const databaseConfigSchema = z.object({
  type: z.enum(['sqlite', 'postgres', 'mysql', 'd1']),
  path: z.string().optional(),
  url: optionalUrlSchema,
});

/**
 * Cloudflare configuration schema
 */
export const cloudflareConfigSchema = z.object({
  accountId: z.string().optional(),
  apiToken: z.string().optional(),
  zoneId: z.string().optional(),
});

/**
 * D1 binding configuration schema
 */
export const d1BindingSchema = z.object({
  name: z.string().min(1),
  databaseName: z.string().min(1),
});

/**
 * KV binding configuration schema
 */
export const kvBindingSchema = z.object({
  name: z.string().min(1),
  namespaceId: z.string().optional(),
});

/**
 * Rate limit configuration schema
 */
export const rateLimitConfigSchema = z.object({
  enabled: z.boolean().default(true),
  windowMs: z.number().default(60000), // 1 minute
  maxRequests: positiveIntSchema.default(60),
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false),
});

/**
 * Log configuration schema
 */
export const logConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  format: z.enum(['json', 'pretty']).default('pretty'),
  file: z.string().optional(),
  maxFiles: z.number().int().positive().optional(),
  maxSize: z.string().optional(),
});

/**
 * Feature flag configuration schema
 */
export const featureFlagSchema = z
  .object({
    enabled: z.boolean(),
    rolloutPercentage: z.number().int().min(0).max(100).optional(),
    whitelist: z.array(z.string()).optional(),
    description: z.string().optional(),
  })
  .refine((val) => val.enabled || val.rolloutPercentage === undefined, {
    message: 'rolloutPercentage requires enabled=true',
  });

/**
 * Effort configuration schema
 */
export const effortConfigSchema = z.object({
  level: z.enum(['minimal', 'normal', 'thorough']).default('normal'),
  maxIterations: positiveIntSchema.default(10),
  timeout: z.number().optional(),
});

/**
 * Webhook configuration schema
 */
export const webhookConfigSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16, 'Webhook secret must be at least 16 characters'),
  events: z.array(z.string()).default(['*']),
});

/**
 * GitHub webhook event schema
 */
export const githubWebhookEventSchema = z.enum([
  'push',
  'pull_request',
  'issues',
  'issue_comment',
  'workflow_dispatch',
  'release',
  'ping',
]);

/**
 * Telegram webhook configuration schema
 */
export const telegramConfigSchema = z.object({
  botToken: nonEmptyString,
  webhookUrl: optionalUrlSchema,
  allowedUsers: z.array(z.union([z.number(), z.string()])).optional(),
  allowedChats: z.array(z.union([z.number(), z.string()])).optional(),
});

/**
 * MCP server configuration schema
 */
export const mcpServerConfigSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
});

/**
 * Tools configuration schema
 */
export const toolsConfigSchema = z.object({
  enabled: z.array(z.string()).default([]),
  disabled: z.array(z.string()).default([]),
  permissions: z.record(z.enum(permissionModeValues)).optional(),
});

/**
 * Complete application configuration schema
 */
export const appConfigSchema = z.object({
  // Core agent config
  agent: agentConfigSchema.optional(),

  // Server config
  server: serverConfigSchema.optional(),

  // Database config
  database: databaseConfigSchema.optional(),

  // Cloudflare config
  cloudflare: cloudflareConfigSchema.optional(),

  // Rate limiting
  rateLimit: rateLimitConfigSchema.optional(),

  // Logging
  log: logConfigSchema.optional(),

  // Feature flags
  features: z.record(featureFlagSchema).optional(),

  // Webhooks
  webhooks: z.array(webhookConfigSchema).optional(),

  // Telegram
  telegram: telegramConfigSchema.optional(),

  // MCP servers
  mcpServers: z.array(mcpServerConfigSchema).optional(),

  // Tools
  tools: toolsConfigSchema.optional(),
});

// Type exports
export type RepositoryConfig = z.infer<typeof repositoryConfigSchema>;
export type AutoMergeConfig = z.infer<typeof autoMergeConfigSchema>;
export type SelfImprovementConfig = z.infer<typeof selfImprovementConfigSchema>;
export type ContinuousConfig = z.infer<typeof continuousConfigSchema>;
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
export type CloudflareConfig = z.infer<typeof cloudflareConfigSchema>;
export type D1Binding = z.infer<typeof d1BindingSchema>;
export type KVBinding = z.infer<typeof kvBindingSchema>;
export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;
export type LogConfig = z.infer<typeof logConfigSchema>;
export type FeatureFlag = z.infer<typeof featureFlagSchema>;
export type EffortConfig = z.infer<typeof effortConfigSchema>;
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
export type GithubWebhookEvent = z.infer<typeof githubWebhookEventSchema>;
export type TelegramConfig = z.infer<typeof telegramConfigSchema>;
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type ToolsConfig = z.infer<typeof toolsConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
