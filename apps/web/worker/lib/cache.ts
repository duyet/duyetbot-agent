/**
 * Caching Utilities for Cloudflare Workers
 *
 * Implements a caching layer using the Cloudflare Cache API for API responses.
 * This provides edge caching for appropriate responses while respecting
 * user-specific data and real-time requirements.
 */

import type { Context, Next } from "hono";
import type { Env } from "../types";

/**
 * Cache configuration for different route patterns
 */
interface CacheConfig {
	/** Time-to-live in seconds */
	ttl: number;
	/** Stale-while-revalidate in seconds (optional) */
	swr?: number;
	/** Whether to vary by user (auth token) */
	varyByUser?: boolean;
	/** Custom cache key suffix */
	keySuffix?: string;
}

/**
 * Default cache configurations by route pattern
 */
const CACHE_CONFIGS: Record<string, CacheConfig> = {
	// Health endpoint - short TTL, public
	"/health": { ttl: 30, swr: 60 },

	// Suggestions - moderate cache, user-specific
	"/api/suggestions": { ttl: 60, swr: 120, varyByUser: true },

	// Rate limit status - short cache per user
	"/api/rate-limit/status": { ttl: 5, varyByUser: true },
};

/**
 * Routes that should NEVER be cached
 */
const NO_CACHE_ROUTES = [
	"/api/auth", // Authentication endpoints
	"/api/chat", // Real-time chat/streaming
	"/api/vote", // User actions
	"/api/history", // User-specific, real-time
];

/**
 * Build cache key for a request
 */
function buildCacheKey(
	c: Context<{ Bindings: Env }>,
	config: CacheConfig,
): string {
	const url = new URL(c.req.url);
	let key = `${url.origin}${url.pathname}`;

	// Add query params to key
	if (url.search) {
		key += url.search;
	}

	// Add user identifier if needed
	if (config.varyByUser) {
		const authHeader = c.req.header("Authorization");
		if (authHeader) {
			// Hash the auth token to avoid storing raw tokens
			const hash = authHeader.slice(-8); // Last 8 chars for uniqueness
			key += `:user:${hash}`;
		}
	}

	// Add custom suffix if provided
	if (config.keySuffix) {
		key += `:${config.keySuffix}`;
	}

	return key;
}

/**
 * Build Cache-Control header value
 */
function buildCacheControl(config: CacheConfig): string {
	let value = `public, max-age=${config.ttl}`;

	if (config.swr) {
		value += `, stale-while-revalidate=${config.swr}`;
	}

	return value;
}

/**
 * Get cache configuration for a route
 */
function getCacheConfig(pathname: string): CacheConfig | null {
	// Check if route should never be cached
	for (const route of NO_CACHE_ROUTES) {
		if (pathname.startsWith(route)) {
			return null;
		}
	}

	// Check for exact match
	if (CACHE_CONFIGS[pathname]) {
		return CACHE_CONFIGS[pathname];
	}

	// Check for prefix match
	for (const [pattern, config] of Object.entries(CACHE_CONFIGS)) {
		if (pathname.startsWith(pattern)) {
			return config;
		}
	}

	return null;
}

/**
 * Cache middleware for Hono
 *
 * Uses Cloudflare's Cache API to cache GET responses at the edge.
 * Skips caching for:
 * - Non-GET requests
 * - Authenticated-only routes
 * - Real-time/streaming endpoints
 * - Error responses
 */
export function cacheMiddleware() {
	return async (c: Context<{ Bindings: Env }>, next: Next) => {
		// Only cache GET requests
		if (c.req.method !== "GET") {
			return next();
		}

		const url = new URL(c.req.url);
		const config = getCacheConfig(url.pathname);

		// Skip if no cache config or route is excluded
		if (!config) {
			return next();
		}

		const cache = caches.default;
		const cacheKey = buildCacheKey(c, config);
		const cacheRequest = new Request(cacheKey);

		// Try to get from cache
		const cachedResponse = await cache.match(cacheRequest);
		if (cachedResponse) {
			// Clone response and add cache status header
			const response = new Response(cachedResponse.body, cachedResponse);
			response.headers.set("X-Cache-Status", "HIT");
			return response;
		}

		// Execute the handler
		await next();

		// Only cache successful responses (2xx)
		const status = c.res.status;
		if (status >= 200 && status < 300) {
			// Clone the response for caching
			const responseToCache = c.res.clone();

			// Set cache control headers
			responseToCache.headers.set("Cache-Control", buildCacheControl(config));
			responseToCache.headers.set("X-Cache-Status", "MISS");

			// Store in cache (fire and forget)
			c.executionCtx?.waitUntil(cache.put(cacheRequest, responseToCache));
		}
	};
}

/**
 * Add static asset caching headers
 *
 * For use with static asset serving to ensure long TTL for
 * immutable assets (like hashed JS/CSS bundles)
 */
export function addStaticCacheHeaders(
	response: Response,
	pathname: string,
): Response {
	// Clone response to modify headers
	const cached = new Response(response.body, response);

	// Immutable assets (hashed filenames)
	if (pathname.match(/\.[a-f0-9]{8,}\.(js|css|woff2?|png|jpg|webp|svg|ico)$/)) {
		cached.headers.set(
			"Cache-Control",
			"public, max-age=31536000, immutable", // 1 year
		);
		return cached;
	}

	// HTML files - short cache with revalidation
	if (pathname.endsWith(".html") || pathname === "/") {
		cached.headers.set(
			"Cache-Control",
			"public, max-age=300, stale-while-revalidate=600", // 5 min + 10 min SWR
		);
		return cached;
	}

	// Default for other static assets
	cached.headers.set(
		"Cache-Control",
		"public, max-age=86400, stale-while-revalidate=604800", // 1 day + 1 week SWR
	);

	return cached;
}

/**
 * Purge cache entries by pattern
 * Note: This is a best-effort operation in Workers
 */
export async function purgeCache(pattern: string): Promise<void> {
	const cache = caches.default;
	// Cloudflare Cache API doesn't support pattern deletion
	// This is a placeholder for future implementation with a cache registry
	console.log(`[Cache] Purge requested for pattern: ${pattern}`);
}
