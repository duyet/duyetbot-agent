/**
 * Builder utility for reconstructing transport context from pending messages
 *
 * Handles the complex logic of rebuilding platform-specific transport contexts
 * from pending batch messages, including injection of environment-specific
 * secrets (bot tokens, API keys) and platform configuration.
 *
 * DEPRECATION NOTICE:
 * This builder is kept for backward compatibility with older messages that don't have
 * serializedContext. New code should use deserializeContext() from ../context/global-context.js
 * when available.
 */

import type { PendingMessage, PlatformConfig } from './types.js';

/**
 * Type for platform identifier
 */
export type Platform = 'telegram' | 'github' | string;

/**
 * Context builder for reconstructing transport contexts from batch messages
 *
 * When processing a batch, we need to rebuild the original transport context
 * (e.g., TContext for Telegram or GitHub transport) from the first pending
 * message. This is complex because:
 * - originalContext only contains metadata (platform, requestId, parseMode)
 * - Core fields (chatId, userId) come from the message
 * - Platform secrets (bot token, API key) must be injected from environment
 *
 * @example
 * ```typescript
 * const builder = new ContextBuilder((env) => ({
 *   platform: env.PLATFORM || 'telegram'
 * }));
 *
 * const context = builder.buildFromPendingMessage(
 *   firstMessage,
 *   combinedText,
 *   env,
 *   'telegram'
 * );
 * ```
 */
export class ContextBuilder<TContext = unknown, TEnv = Record<string, unknown>> {
  /**
   * Create a ContextBuilder instance
   *
   * @param extractPlatformConfig - Optional function to extract platform config from env
   */
  constructor(private extractPlatformConfig?: (env: TEnv) => PlatformConfig | undefined) {}

  /**
   * Build a context from a pending message for /clear command processing
   *
   * Used when processing a /clear command that needs to maintain the original
   * context structure but with updated text.
   *
   * @param message - First pending message with originalContext
   * @param text - Text to use in context (e.g., original or combined)
   * @param env - Environment with platform secrets
   * @param platform - Platform identifier (telegram, github, etc.)
   * @returns Reconstructed context with text and secrets injected
   *
   * @example
   * ```typescript
   * // Processing /clear command
   * const clearCtx = builder.buildFromPendingMessage(
   *   firstMessage,
   *   '/clear',
   *   env,
   *   'telegram'
   * );
   * await this.handle(clearCtx);
   * ```
   */
  buildFromPendingMessage(
    message: PendingMessage<TContext> | undefined,
    text: string,
    env: TEnv,
    platform: Platform
  ): TContext {
    // Fallback context if no original context
    const fallbackCtx: TContext = {
      chatId: message?.chatId,
      userId: message?.userId,
      text,
      metadata: { requestId: crypto.randomUUID() },
    } as TContext;

    // Get base context (prefers originalContext which has platform metadata)
    const baseCtx = message?.originalContext ?? fallbackCtx;

    // Extract env config for platform secrets
    const envConfig = this._extractEnvConfig(env, platform);

    // Build final context with:
    // 1. All fields from baseCtx (preserves metadata)
    // 2. Updated text (may differ from originalContext if combined from multiple)
    // 3. Core fields from message (originalContext may lack these)
    // 4. Platform secrets from environment
    const ctx: TContext = {
      ...baseCtx,
      text,
      chatId: message?.chatId,
      userId: message?.userId,
      ...(message?.username && { username: message.username }),
      ...envConfig,
    } as TContext;

    return ctx;
  }

  /**
   * Extract platform-specific configuration and secrets from environment
   *
   * @param env - Environment variables
   * @param platform - Platform identifier
   * @returns Object with platform-specific fields to inject
   * @internal
   */
  private _extractEnvConfig(env: TEnv, platform: Platform): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    // Allow custom extraction if provided
    if (this.extractPlatformConfig) {
      const customConfig = this.extractPlatformConfig(env);
      if (customConfig) {
        Object.assign(config, customConfig);
      }
    }

    // Inject platform-specific secrets
    const envRecord = env as unknown as Record<string, unknown>;

    if (platform === 'telegram') {
      if (envRecord.TELEGRAM_BOT_TOKEN) {
        config.token = envRecord.TELEGRAM_BOT_TOKEN;
      }
    }

    if (platform === 'github') {
      if (envRecord.GITHUB_TOKEN) {
        config.githubToken = envRecord.GITHUB_TOKEN;
      }
    }

    return config;
  }
}
