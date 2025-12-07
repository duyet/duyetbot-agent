/**
 * Environment Type Definitions
 * Type declarations for Cloudflare Pages runtime
 */

declare global {
  interface RequestInit {
    cf?: Record<string, unknown>;
  }
}

export interface Env {
  DB: D1Database;
}

export {};
