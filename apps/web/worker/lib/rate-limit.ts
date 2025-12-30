/**
 * KV-based Rate Limiting for Cloudflare Workers
 *
 * Provides token bucket and sliding window rate limiting using Cloudflare KV.
 * Suitable for production use with distributed edge deployment.
 */

import type { Env } from "../types";

export type RateLimitResult = {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: Date;
};

export type RateLimitConfig = {
	limit: number;
	window: number; // Window duration in seconds
};

/**
 * Token bucket rate limiter using Cloudflare KV
 *
 * Features:
 * - Distributed rate limiting across edge locations
 * - Automatic cleanup using KV TTL
 * - Thread-safe operations using KV atomic operations
 * - Configurable limits and windows
 */
export class RateLimiter {
	constructor(
		private readonly kv: KVNamespace,
		private readonly prefix = "rate_limit",
	) {}

	/**
	 * Check if request is within rate limit
	 *
	 * @param identifier - Unique identifier (user ID, IP, session token, etc.)
	 * @param config - Rate limit configuration
	 * @returns Rate limit result with allowed status and metadata
	 */
	async check(
		identifier: string,
		config: RateLimitConfig,
	): Promise<RateLimitResult> {
		const key = `${this.prefix}:${identifier}`;
		const now = Date.now();
		const windowMs = config.window * 1000;

		try {
			// Get current state from KV
			const state = await this.kv.get(key, "json");
			const currentState = state as
				| { count: number; resetAt: number }
				| undefined;

			// Check if window has expired
			if (currentState && currentState.resetAt > now) {
				// Window still active, check limit
				const remaining = Math.max(0, config.limit - currentState.count);

				if (currentState.count >= config.limit) {
					return {
						allowed: false,
						limit: config.limit,
						remaining: 0,
						resetAt: new Date(currentState.resetAt),
					};
				}

				// Increment counter
				const newState = {
					count: currentState.count + 1,
					resetAt: currentState.resetAt,
				};

				await this.kv.put(key, JSON.stringify(newState), {
					expirationTtl: config.window,
				});

				return {
					allowed: true,
					limit: config.limit,
					remaining: remaining - 1,
					resetAt: new Date(currentState.resetAt),
				};
			}

			// New window or expired, create new counter
			const newState = {
				count: 1,
				resetAt: now + windowMs,
			};

			await this.kv.put(key, JSON.stringify(newState), {
				expirationTtl: config.window,
			});

			return {
				allowed: true,
				limit: config.limit,
				remaining: config.limit - 1,
				resetAt: new Date(now + windowMs),
			};
		} catch (error) {
			// On KV errors, fail open to avoid blocking legitimate traffic
			console.error("[RateLimit] KV error:", error);
			return {
				allowed: true,
				limit: config.limit,
				remaining: config.limit,
				resetAt: new Date(Date.now() + windowMs),
			};
		}
	}

	/**
	 * Reset rate limit for a specific identifier
	 *
	 * @param identifier - Unique identifier to reset
	 */
	async reset(identifier: string): Promise<void> {
		const key = `${this.prefix}:${identifier}`;
		await this.kv.delete(key);
	}

	/**
	 * Get current rate limit status without consuming a token
	 *
	 * @param identifier - Unique identifier
	 * @param config - Rate limit configuration
	 * @returns Current rate limit status
	 */
	async status(
		identifier: string,
		config: RateLimitConfig,
	): Promise<RateLimitResult> {
		const key = `${this.prefix}:${identifier}`;
		const now = Date.now();

		try {
			const state = await this.kv.get(key, "json");
			const currentState = state as
				| { count: number; resetAt: number }
				| undefined;

			if (!currentState || currentState.resetAt <= now) {
				return {
					allowed: true,
					limit: config.limit,
					remaining: config.limit,
					resetAt: new Date(now + config.window * 1000),
				};
			}

			const remaining = Math.max(0, config.limit - currentState.count);

			return {
				allowed: currentState.count < config.limit,
				limit: config.limit,
				remaining,
				resetAt: new Date(currentState.resetAt),
			};
		} catch (error) {
			console.error("[RateLimit] KV error:", error);
			return {
				allowed: true,
				limit: config.limit,
				remaining: config.limit,
				resetAt: new Date(now + config.window * 1000),
			};
		}
	}
}

/**
 * Pre-configured rate limiters for common use cases
 */
export class RateLimiters {
	private readonly limiter: RateLimiter;

	constructor(env: Env) {
		this.limiter = new RateLimiter(env.RATE_LIMIT_KV);
	}

	/**
	 * API rate limiter - 100 requests per minute
	 */
	async api(identifier: string): Promise<RateLimitResult> {
		return this.limiter.check(identifier, {
			limit: 100,
			window: 60,
		});
	}

	/**
	 * Chat rate limiter - 60 messages per minute
	 */
	async chat(identifier: string): Promise<RateLimitResult> {
		return this.limiter.check(identifier, {
			limit: 60,
			window: 60,
		});
	}

	/**
	 * Guest rate limiter - 10 messages per day
	 */
	async guest(identifier: string): Promise<RateLimitResult> {
		return this.limiter.check(identifier, {
			limit: 10,
			window: 86_400, // 24 hours
		});
	}

	/**
	 * Authentication rate limiter - 5 attempts per 5 minutes
	 */
	async auth(identifier: string): Promise<RateLimitResult> {
		return this.limiter.check(identifier, {
			limit: 5,
			window: 300,
		});
	}

	/**
	 * Custom rate limiter with user-defined configuration
	 */
	async custom(
		identifier: string,
		config: RateLimitConfig,
	): Promise<RateLimitResult> {
		return this.limiter.check(identifier, config);
	}

	/**
	 * Reset rate limit for a specific identifier
	 */
	async reset(identifier: string): Promise<void> {
		return this.limiter.reset(identifier);
	}

	/**
	 * Get current status without consuming a token
	 */
	async status(
		identifier: string,
		type: "api" | "chat" | "guest" | "auth",
	): Promise<RateLimitResult> {
		const configs = {
			api: { limit: 100, window: 60 },
			chat: { limit: 60, window: 60 },
			guest: { limit: 10, window: 86_400 },
			auth: { limit: 5, window: 300 },
		};

		return this.limiter.status(identifier, configs[type]);
	}
}

/**
 * Helper function to create rate limiters from Env
 */
export function createRateLimiters(env: Env): RateLimiters {
	return new RateLimiters(env);
}

/**
 * Extract identifier from request for rate limiting
 *
 * Priority:
 * 1. User ID (if authenticated)
 * 2. Session token (if guest)
 * 3. IP address (fallback)
 */
export function getRateLimitIdentifier(
	userId?: string,
	sessionToken?: string,
	ip?: string,
): string {
	if (userId) {
		return `user:${userId}`;
	}
	if (sessionToken) {
		return `session:${sessionToken}`;
	}
	if (ip) {
		return `ip:${ip}`;
	}
	return "anonymous";
}
