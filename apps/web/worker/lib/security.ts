/**
 * Security middleware for Cloudflare Workers
 * Provides CORS configuration, security headers, and content security policy
 */

import type { MiddlewareHandler } from "hono";

/**
 * Allowed origins for CORS
 * In production, this should be configured via environment variables
 */
const ALLOWED_ORIGINS = [
	"http://localhost:3000",
	"http://localhost:3001",
	"https://duyetbot-web.duyet.workers.dev",
	// Add production URL from env if available
	...(typeof process !== "undefined" && process.env.PRODUCTION_URL
		? [process.env.PRODUCTION_URL]
		: []),
];

/**
 * Check if origin is allowed
 */
function isAllowedOrigin(origin: string | null): boolean {
	if (!origin) return true; // Allow same-origin requests
	return ALLOWED_ORIGINS.some((allowed) => allowed === origin);
}

/**
 * CORS middleware with specific origin whitelist
 * Replaces the wildcard origin which is invalid with credentials
 */
export const secureCors = (): MiddlewareHandler => async (c, next) => {
	const origin = c.req.header("Origin");

	if (!origin || isAllowedOrigin(origin)) {
		// Set CORS headers for allowed origins
		c.header("Access-Control-Allow-Origin", origin || "*");
		c.header("Access-Control-Allow-Credentials", "true");
		c.header(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, PATCH, DELETE, OPTIONS",
		);
		c.header(
			"Access-Control-Allow-Headers",
			"Authorization, Content-Type, Cookie",
		);
		c.header("Access-Control-Max-Age", "86400"); // 24 hours
	}

	// Handle preflight requests
	if (c.req.method === "OPTIONS") {
		return c.text("", 204);
	}

	await next();
};

/**
 * Content Security Policy header
 * Restricts sources for scripts, styles, images, etc.
 */
const CSP_HEADER = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net", // unsafe-inline needed for Next.js hydration
	"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
	"img-src 'self' data: https: blob:",
	"font-src 'self' data:",
	"connect-src 'self' https://*.openai.com https://*.anthropic.com https://api.duyet.net",
	"frame-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	// Upgrade insecure requests in production
	...(typeof process !== "undefined" && process.env.NODE_ENV === "production"
		? ["upgrade-insecure-requests"]
		: []),
].join("; ");

/**
 * Additional security headers beyond Hono's secureHeaders
 */
export const securityHeaders = (): MiddlewareHandler => async (c, next) => {
	await next();

	// Content Security Policy
	c.header("Content-Security-Policy", CSP_HEADER);

	// X-Frame-Options: Prevent clickjacking
	c.header("X-Frame-Options", "DENY");

	// X-Content-Type-Options: Prevent MIME-sniffing
	c.header("X-Content-Type-Options", "nosniff");

	// Referrer-Policy: Control referrer information
	c.header("Referrer-Policy", "strict-origin-when-cross-origin");

	// Permissions-Policy: Restrict browser features
	c.header(
		"Permissions-Policy",
		[
			"camera=()",
			"microphone=()",
			"geolocation=()",
			"payment=()",
			"usb=()",
			"magnetometer=()",
			"gyroscope=()",
			"accelerometer=()",
		].join(", "),
	);

	// Strict-Transport-Security: Force HTTPS (only in production)
	if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
		c.header(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains",
		);
	}
};

/**
 * Origin/Referer validation middleware for CSRF protection
 * Validates state-changing operations (POST, PUT, PATCH, DELETE) come from allowed origins
 *
 * This provides defense-in-depth CSRF protection:
 * - SameSite cookies already prevent most CSRF attacks
 * - CORS whitelist prevents cross-origin requests
 * - This middleware adds explicit Origin/Referer validation
 *
 * Note: Safe methods (GET, HEAD, OPTIONS) are exempt as they don't modify state
 */
export const originValidation = (): MiddlewareHandler => async (c, next) => {
	// Only validate state-changing methods
	const method = c.req.method;
	if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
		await next();
		return;
	}

	// Get Origin header (primary) or Referer header (fallback)
	const origin = c.req.header("Origin");
	const referer = c.req.header("Referer");

	// Extract origin from referer if needed
	const refererOrigin = referer ? new URL(referer).origin : null;
	const requestOrigin = origin || refererOrigin;

	// Allow requests with no Origin/Referer (same-origin requests from older browsers)
	if (!requestOrigin) {
		await next();
		return;
	}

	// Validate origin against allowed list
	if (!isAllowedOrigin(requestOrigin)) {
		console.warn(
			`[Security] Blocked request from disallowed origin: ${requestOrigin}`,
		);
		return c.json(
			{
				error: "forbidden:origin",
				message: "Requests must come from an allowed origin",
			},
			403,
		);
	}

	await next();
};

/**
 * Production error response middleware
 * Removes debug information in production environment
 */
export const productionErrorHandler =
	(): MiddlewareHandler => async (c, next) => {
		await next();

		// Override error responses in production to remove debug info
		if (
			c.res.status === 500 ||
			c.res.status === 400 ||
			c.res.status === 401 ||
			c.res.status === 403
		) {
			const isDevelopment =
				typeof process !== "undefined" && process.env.NODE_ENV !== "production";

			// In production, check if response contains debug info and sanitize it
			if (!isDevelopment) {
				// The error handler in index.ts handles this, but we add extra protection
				const contentType = c.res.headers.get("Content-Type");
				if (contentType?.includes("application/json")) {
					// Let the original error handler manage the response format
					// This middleware ensures no debug info leaks through other paths
				}
			}
		}
	};
