/**
 * Request ID Middleware
 *
 * Generates unique request IDs for tracking and correlation
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types';

/**
 * Request ID middleware
 * Generates a unique ID for each request and adds it to response headers
 */
export async function requestIdMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // Check if request ID already exists (from upstream proxy/load balancer)
  const existingId =
    c.req.header('X-Request-ID') || c.req.header('X-Request-Id') || c.req.header('CF-Ray'); // Cloudflare Ray ID

  // Generate new ID if none exists
  const requestId = existingId || crypto.randomUUID();

  // Store in context for access in handlers
  c.set('requestId', requestId);

  // Add to response headers
  c.header('X-Request-ID', requestId);

  await next();
}

/**
 * Get request ID from context
 */
export function getRequestId(c: Context): string {
  return c.get('requestId') as string;
}
