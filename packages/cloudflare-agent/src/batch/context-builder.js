/**
 * Builder utility for reconstructing transport context from pending messages
 *
 * Handles the complex logic of rebuilding platform-specific transport contexts
 * from pending batch messages, including injection of environment-specific
 * secrets (bot tokens, API keys) and platform configuration.
 */
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
export class ContextBuilder {
  extractPlatformConfig;
  /**
   * Create a ContextBuilder instance
   *
   * @param extractPlatformConfig - Optional function to extract platform config from env
   */
  constructor(extractPlatformConfig) {
    this.extractPlatformConfig = extractPlatformConfig;
  }
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
  buildFromPendingMessage(message, text, env, platform) {
    // Fallback context if no original context
    const fallbackCtx = {
      chatId: message?.chatId,
      userId: message?.userId,
      text,
      metadata: { requestId: crypto.randomUUID() },
    };
    // Get base context (prefers originalContext which has platform metadata)
    const baseCtx = message?.originalContext ?? fallbackCtx;
    // Extract env config for platform secrets
    const envConfig = this._extractEnvConfig(env, platform);
    // Build final context with:
    // 1. All fields from baseCtx (preserves metadata)
    // 2. Updated text (may differ from originalContext if combined from multiple)
    // 3. Core fields from message (originalContext may lack these)
    // 4. Platform secrets from environment
    const ctx = {
      ...baseCtx,
      text,
      chatId: message?.chatId,
      userId: message?.userId,
      ...(message?.username && { username: message.username }),
      ...envConfig,
    };
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
  _extractEnvConfig(env, platform) {
    const config = {};
    // Allow custom extraction if provided
    if (this.extractPlatformConfig) {
      const customConfig = this.extractPlatformConfig(env);
      if (customConfig) {
        Object.assign(config, customConfig);
      }
    }
    // Inject platform-specific secrets
    const envRecord = env;
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
