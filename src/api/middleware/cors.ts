/**
 * CORS Middleware
 *
 * Cross-Origin Resource Sharing configuration
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types';

/**
 * CORS middleware
 */
export async function corsMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const env = c.env;
  const origin = c.req.header('Origin');

  // Allowed origins
  const allowedOrigins = getAllowedOrigins(env);

  // Check if origin is allowed
  const isAllowed =
    origin &&
    allowedOrigins.some((allowed) => {
      if (allowed === '*') {
        return true;
      }
      if (allowed.endsWith('*')) {
        const prefix = allowed.slice(0, -1);
        return origin.startsWith(prefix);
      }
      return origin === allowed;
    });

  if (isAllowed && origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  c.header('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
}

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(env: Env): string[] {
  const origins: string[] = [];

  if (env.ENVIRONMENT === 'development') {
    origins.push('http://localhost:*');
    origins.push('http://127.0.0.1:*');
  }

  if (env.WEB_URL) {
    origins.push(env.WEB_URL);
  }

  // Add production domains
  if (env.ENVIRONMENT === 'production') {
    origins.push('https://agent.duyet.net');
    origins.push('https://api.duyet.net');
  }

  return origins;
}
