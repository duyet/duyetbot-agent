/**
 * Builder utility for reconstructing transport context from pending messages
 *
 * Handles the complex logic of rebuilding platform-specific transport contexts
 * from pending batch messages, including injection of environment-specific
 * secrets (bot tokens, API keys) and platform configuration.
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
export declare class ContextBuilder<TContext = unknown, TEnv = Record<string, unknown>> {
  private extractPlatformConfig?;
  /**
   * Create a ContextBuilder instance
   *
   * @param extractPlatformConfig - Optional function to extract platform config from env
   */
  constructor(extractPlatformConfig?: ((env: TEnv) => PlatformConfig | undefined) | undefined);
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
  ): TContext;
  /**
   * Extract platform-specific configuration and secrets from environment
   *
   * @param env - Environment variables
   * @param platform - Platform identifier
   * @returns Object with platform-specific fields to inject
   * @internal
   */
  private _extractEnvConfig;
}
//# sourceMappingURL=context-builder.d.ts.map
