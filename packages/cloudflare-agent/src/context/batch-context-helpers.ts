/**
 * Batch Context Helpers
 *
 * Helper functions for extracting and transforming context values
 * between stages in the message processing pipeline:
 *
 * ParsedInput → PendingMessage → reconstructed TContext → ResponseTarget
 *
 * These helpers consolidate repeated extraction patterns and ensure
 * consistent priority chains for admin context resolution.
 */

import type { PlatformConfig } from '../agents/base-agent.js';
import type { PendingMessage } from '../batch-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Extracted admin context with resolved priority chain
 */
export interface AdminContext {
  /** Whether the user is an admin */
  isAdmin: boolean;
  /** Admin username for comparison */
  adminUsername: string | undefined;
  /** Current user's username */
  username: string | undefined;
}

/**
 * Sources for admin context extraction with priority order
 */
export interface AdminContextSources<TContext = unknown> {
  /** Transport context (highest priority for adminUsername) */
  ctx?: TContext;
  /** Pending message from batch (middle priority) */
  message?: PendingMessage<TContext>;
  /** Environment variables (lowest priority fallback) */
  env?: { ADMIN_USERNAME?: string };
}

/**
 * Extracted metadata fields from ParsedInput.metadata
 */
export interface ExtractedMetadata {
  eventId: string | undefined;
  isAdmin: boolean | undefined;
  adminUsername: string | undefined;
  requestId: string | undefined;
  traceId: string | undefined;
  platform: string | undefined;
}

/**
 * Options for building context from batch first message
 */
export interface BuildContextOptions<TContext, TEnv> {
  /** First message in the batch */
  firstMessage: PendingMessage<TContext>;
  /** Combined or original text to use */
  text: string;
  /** Environment bindings */
  env: TEnv;
  /** Platform type for secret injection */
  platform?: 'telegram' | 'github' | string;
  /** Batch ID for fallback metadata */
  batchId?: string;
}

/**
 * Platform-specific response target for RouterAgent
 * (Matches ScheduleRoutingTarget from cloudflare-agent.ts)
 */
export interface ResponseTarget {
  chatId: string;
  messageRef: { messageId: number };
  platform: string;
  botToken?: string | undefined;
  adminUsername?: string | undefined;
  username?: string | undefined;
  platformConfig?: PlatformConfig | undefined;
  // GitHub-specific fields
  githubOwner?: string | undefined;
  githubRepo?: string | undefined;
  githubIssueNumber?: number | undefined;
  githubToken?: string | undefined;
}

/**
 * Options for building response target
 */
export interface BuildResponseTargetOptions<TContext, TEnv> {
  /** Reconstructed transport context */
  ctx: TContext;
  /** First message from batch */
  firstMessage: PendingMessage<TContext>;
  /** Message ID from transport.send() */
  messageId: number;
  /** Target platform */
  platform: string;
  /** Environment bindings */
  env: TEnv;
  /** Platform configuration */
  platformConfig?: PlatformConfig;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract admin context from multiple sources with priority chain
 *
 * Priority for adminUsername: ctx → message → env
 * Priority for username: ctx → message
 * Priority for isAdmin: message → ctx
 *
 * @example
 * ```typescript
 * const admin = extractAdminContext({ ctx, message: firstMessage, env });
 * if (admin.isAdmin) {
 *   // Show debug footer
 * }
 * ```
 */
export function extractAdminContext<TContext = unknown>(
  sources: AdminContextSources<TContext>
): AdminContext {
  const { ctx, message, env } = sources;

  // Type cast to access potential admin fields
  const ctxAdmin = ctx as
    | { adminUsername?: string; username?: string; isAdmin?: boolean }
    | undefined;

  // Priority chain for adminUsername: ctx → message → env
  const adminUsername =
    ctxAdmin?.adminUsername || message?.adminUsername || env?.ADMIN_USERNAME || undefined;

  // Priority chain for username: ctx → message
  const username = ctxAdmin?.username || message?.username || undefined;

  // isAdmin check: message takes priority (persisted from webhook), then ctx
  const isAdmin = message?.isAdmin ?? ctxAdmin?.isAdmin ?? false;

  return { isAdmin, adminUsername, username };
}

/**
 * Extract common metadata fields from ParsedInput.metadata
 *
 * Provides type-safe extraction of frequently used metadata fields
 * with proper undefined handling.
 *
 * @example
 * ```typescript
 * const { eventId, isAdmin, adminUsername } = extractMessageMetadata(input.metadata);
 * ```
 */
export function extractMessageMetadata(metadata?: Record<string, unknown>): ExtractedMetadata {
  if (!metadata) {
    return {
      eventId: undefined,
      isAdmin: undefined,
      adminUsername: undefined,
      requestId: undefined,
      traceId: undefined,
      platform: undefined,
    };
  }

  return {
    eventId: (metadata.eventId as string) ?? undefined,
    isAdmin: (metadata.isAdmin as boolean) ?? undefined,
    adminUsername: (metadata.adminUsername as string) ?? undefined,
    requestId: (metadata.requestId as string) ?? undefined,
    traceId: (metadata.traceId as string) ?? undefined,
    platform: (metadata.platform as string) ?? undefined,
  };
}

/**
 * Build transport context from batch's first message
 *
 * Consolidates the repeated pattern of:
 * 1. Using originalContext or creating fallback
 * 2. Overriding text with combined/processed text
 * 3. Injecting core fields from firstMessage
 * 4. Injecting platform-specific secrets from env
 *
 * @example
 * ```typescript
 * const ctx = buildContextFromBatch({
 *   firstMessage,
 *   text: combinedText,
 *   env,
 *   platform: 'telegram',
 *   batchId: batch.batchId,
 * });
 * ```
 */
export function buildContextFromBatch<TContext, TEnv>(
  options: BuildContextOptions<TContext, TEnv>
): TContext {
  const { firstMessage, text, env, platform, batchId } = options;

  // Build base context from originalContext or create minimal fallback
  const baseCtx =
    firstMessage.originalContext ??
    ({
      chatId: firstMessage.chatId,
      userId: firstMessage.userId,
      text,
      metadata: { requestId: batchId },
    } as TContext);

  // Extract platform secrets from env
  const envWithSecrets = env as {
    TELEGRAM_BOT_TOKEN?: string;
    GITHUB_TOKEN?: string;
  };

  // Build platform-specific secret injection
  const platformSecrets = {
    ...(platform === 'telegram' && { token: envWithSecrets.TELEGRAM_BOT_TOKEN }),
    ...(platform === 'github' && { githubToken: envWithSecrets.GITHUB_TOKEN }),
  };

  // Merge: base context + text override + core fields + platform secrets
  return {
    ...baseCtx,
    text,
    chatId: firstMessage.chatId,
    userId: firstMessage.userId,
    username: firstMessage.username,
    ...platformSecrets,
  } as TContext;
}

/**
 * Build response target for RouterAgent scheduling
 *
 * Consolidates the complex ResponseTarget construction with:
 * - Admin context extraction via priority chain
 * - Platform-specific field population
 * - Proper fallback handling
 *
 * @example
 * ```typescript
 * const responseTarget = buildResponseTarget({
 *   ctx,
 *   firstMessage,
 *   messageId,
 *   platform: 'telegram',
 *   env,
 *   platformConfig,
 * });
 * ```
 */
export function buildResponseTarget<TContext, TEnv>(
  options: BuildResponseTargetOptions<TContext, TEnv>
): ResponseTarget {
  const { ctx, firstMessage, messageId, platform, env, platformConfig } = options;

  // Cast env to access admin username with proper constraint
  const envWithAdmin = env as { ADMIN_USERNAME?: string };

  // Extract admin context with priority chain
  const adminContext = extractAdminContext({ ctx, message: firstMessage, env: envWithAdmin });

  // Extract platform tokens from env
  const envWithSecrets = env as {
    TELEGRAM_BOT_TOKEN?: string;
    GITHUB_TOKEN?: string;
  };

  // Build base target
  const target: ResponseTarget = {
    chatId: firstMessage.chatId?.toString() || '',
    messageRef: { messageId },
    platform,
    adminUsername: adminContext.adminUsername,
    username: adminContext.username,
    platformConfig,
  };

  // Add platform-specific fields
  if (platform === 'telegram') {
    target.botToken = envWithSecrets.TELEGRAM_BOT_TOKEN;
  } else if (platform === 'github') {
    // Extract GitHub-specific fields from ctx
    const ghCtx = ctx as {
      owner?: string;
      repo?: string;
      issueNumber?: number;
      githubToken?: string;
    };
    if (ghCtx.owner !== undefined) {
      target.githubOwner = ghCtx.owner;
    }
    if (ghCtx.repo !== undefined) {
      target.githubRepo = ghCtx.repo;
    }
    if (ghCtx.issueNumber !== undefined) {
      target.githubIssueNumber = ghCtx.issueNumber;
    }
    target.githubToken = ghCtx.githubToken || envWithSecrets.GITHUB_TOKEN;
  }

  return target;
}
