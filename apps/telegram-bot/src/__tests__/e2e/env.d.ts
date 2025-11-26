/**
 * Type declarations for cloudflare:test module
 *
 * These types are needed for E2E tests running in the Workers runtime
 * via @cloudflare/vitest-pool-workers
 *
 * Note: This uses wrangler.test.toml which only includes local TelegramAgent DO.
 * External DOs (RouterAgent, SimpleAgent, etc.) are not available in test mode
 * as they require the duyetbot-agents worker to be running.
 */

declare module 'cloudflare:test' {
  /**
   * Environment bindings from wrangler.test.toml
   * Limited to local bindings for isolated E2E testing
   */
  interface ProvidedEnv {
    // Local Durable Object (type from @cloudflare/workers-types)
    TelegramAgent: import('@cloudflare/workers-types').DurableObjectNamespace;

    // Environment variables from wrangler.test.toml [vars]
    ENVIRONMENT: string;
    MODEL: string;
    AI_GATEWAY_NAME: string;
    AI_GATEWAY_PROVIDER: string;
    TELEGRAM_ADMIN: string;
    TELEGRAM_ALLOWED_USERS: string;
  }
}
