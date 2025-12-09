/**
 * Environment Type Definitions
 * Type declarations for Cloudflare Workers/OpenNext runtime
 */

// Import Cloudflare Workers types
/// <reference types="@cloudflare/workers-types" />

declare global {
  interface RequestInit {
    cf?: Record<string, unknown>;
  }

  /**
   * CloudflareEnv interface for OpenNext getCloudflareContext()
   * This must match the bindings defined in wrangler.toml
   */
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export interface Env {
  DB: D1Database;
}
