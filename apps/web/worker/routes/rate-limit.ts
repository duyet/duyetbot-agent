/**
 * Rate Limit Status API Routes
 *
 * Provides endpoints for users to check their current rate limit status.
 * This allows the frontend to display remaining message counts.
 */

import { Hono } from "hono";
import { createRateLimiters, getRateLimitIdentifier } from "../lib/rate-limit";
import type { Env } from "../types";

export const rateLimitRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/rate-limit/status
 *
 * Returns the current rate limit status for the requesting user.
 * Uses the same identification logic as the chat endpoint.
 *
 * Response:
 * - isGuest: boolean - whether user is a guest
 * - limit: number - total messages allowed in window
 * - remaining: number - messages remaining
 * - resetAt: string (ISO) - when the window resets
 * - windowDescription: string - human-readable window description
 */
rateLimitRoutes.get("/status", async (c) => {
	const requestId = crypto.randomUUID().slice(0, 8);

	// Check if KV binding exists
	if (!c.env.RATE_LIMIT_KV) {
		return c.json(
			{
				error: "rate_limit_not_configured",
				message: "Rate limiting is not configured on this server",
			},
			503,
		);
	}

	try {
		// Get session from cookie (same logic as chat route)
		const cookieHeader = c.req.header("Cookie") || "";
		const sessionCookie = cookieHeader
			.split(";")
			.find((c) => c.trim().startsWith("session="));
		const sessionToken = sessionCookie?.split("=")[1]?.trim();

		// Get Authorization header for bearer token
		const authHeader = c.req.header("Authorization");
		const bearerToken = authHeader?.startsWith("Bearer ")
			? authHeader.slice(7)
			: undefined;

		const token = bearerToken || sessionToken;

		// Parse session JWT to get user info (simplified - just check if guest)
		let isGuest = true;
		let userId: string | undefined;

		if (token) {
			try {
				// Simple JWT parse (payload only, verification happens in session endpoint)
				const parts = token.split(".");
				if (parts.length === 3) {
					const payload = JSON.parse(atob(parts[1]));
					isGuest = payload.type === "guest";
					userId = payload.sub;
				}
			} catch {
				// Invalid token, treat as unauthenticated/guest
				console.log(`[${requestId}] Invalid token, treating as guest`);
			}
		}

		const rateLimiters = createRateLimiters(c.env);
		const clientIp =
			c.req.header("cf-connecting-ip") ||
			c.req.header("x-forwarded-for") ||
			"unknown";

		const identifier = getRateLimitIdentifier(
			isGuest ? undefined : userId,
			isGuest ? userId : undefined,
			clientIp,
		);

		// Get status without consuming a token
		const status = isGuest
			? await rateLimiters.status(identifier, "guest")
			: await rateLimiters.status(identifier, "chat");

		const windowDescription = isGuest
			? "10 messages per day"
			: "60 messages per minute";

		return c.json({
			isGuest,
			limit: status.limit,
			remaining: status.remaining,
			resetAt: status.resetAt.toISOString(),
			windowDescription,
			// Time until reset in seconds
			resetInSeconds: Math.max(
				0,
				Math.ceil((status.resetAt.getTime() - Date.now()) / 1000),
			),
		});
	} catch (error) {
		console.error(`[${requestId}] Rate limit status error:`, error);
		return c.json(
			{
				error: "internal_error",
				message: "Failed to get rate limit status",
			},
			500,
		);
	}
});
