/**
 * Shared middleware for Hono applications
 *
 * Authentication:
 * - createAuth: Bearer token and API key authentication
 * - createTelegramWebhookAuth: Telegram webhook secret verification
 *
 * For GitHub webhook signature verification, use the app-specific middleware:
 * @see apps/github-bot/src/middlewares/signature.ts
 *
 * Security & Performance:
 * - errorHandler: Global error handling with structured logging
 * - createLogger: Request logging with timing and request IDs
 * - createRateLimiter: In-memory rate limiting (see limitations in rate-limit.ts)
 */
export { createAuth } from './auth.js';
export { errorHandler } from './error-handler.js';
export { createLogger } from './logger.js';
export { clearRateLimitStore, createRateLimiter } from './rate-limit.js';
export { createTelegramWebhookAuth } from './telegram-auth.js';
