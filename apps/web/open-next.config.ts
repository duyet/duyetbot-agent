import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * OpenNext Cloudflare configuration for bundle size optimization
 *
 * Minimal configuration to reduce bundle size for Cloudflare Workers
 * free tier (3 MiB limit).
 */
export default defineCloudflareConfig();
