/**
 * Hono API Worker for duyetbot-web
 * Handles all API routes while Next.js static export serves the UI
 */

import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { addStaticCacheHeaders, cacheMiddleware } from "./lib/cache";
import { WorkerError } from "./lib/errors";
import { productionErrorHandler, secureCors, securityHeaders } from "./lib/security";
// Import route handlers
import { agentsRouter } from "./routes/agents";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { customToolsRouter } from "./routes/custom-tools";
import { docsRouter } from "./routes/docs";
import { documentRoutes, shareRoutes } from "./routes/document";
import { filesRoutes } from "./routes/files";
import { historyRoutes } from "./routes/history";
import { rateLimitRoutes } from "./routes/rate-limit";
import { suggestionsRoutes } from "./routes/suggestions";
import { voteRoutes } from "./routes/vote";
import type { Env } from "./types";

// Create Hono app with Cloudflare bindings
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", secureCors());
app.use("*", securityHeaders());
app.use("*", productionErrorHandler());

// Caching middleware for API responses (after CORS to ensure headers are set)
app.use("/api/*", cacheMiddleware());
app.use("/health", cacheMiddleware());

// Global error handler - catches WorkerError and returns proper HTTP status
app.onError((err, c) => {
	const requestId = crypto.randomUUID().slice(0, 8);
	const path = new URL(c.req.url).pathname;
	const method = c.req.method;
	const isProduction = c.env.ENVIRONMENT === "production";

	// Log error with context (always logged server-side)
	console.error(`[${requestId}] ${method} ${path} - ERROR:`, err);
	console.error(`[${requestId}] Error message:`, err.message);
	console.error(`[${requestId}] Error stack:`, err.stack);

	// If it's a WorkerError, use its toResponse method
	if (err instanceof WorkerError) {
		console.error(
			`[${requestId}] WorkerError code=${err.code}, status=${err.status}`,
		);
		return err.toResponse();
	}

	// For unexpected errors, return safe response
	console.error(
		`[${requestId}] Unexpected error type: ${err.constructor.name}`,
	);

	// In production, return minimal error info to avoid information disclosure
	if (isProduction) {
		return c.json(
			{
				error: "Internal server error",
				requestId,
			},
			500,
		);
	}

	// In development, return detailed debug info
	return c.json(
		{
			error: "Internal server error",
			requestId,
			debug: {
				path,
				method,
				errorType: err.constructor.name,
				message: err.message,
				stack: err.stack?.split("\n").slice(0, 5).join("\n"),
			},
		},
		500,
	);
});

// API routes
app.route("/api/agents", agentsRouter);
app.route("/api/auth", authRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/history", historyRoutes);
app.route("/api/document", documentRoutes);
app.route("/api/files", filesRoutes);
app.route("/api/rate-limit", rateLimitRoutes);
app.route("/api/suggestions", suggestionsRoutes);
app.route("/api/tools/custom", customToolsRouter);
app.route("/api/vote", voteRoutes);
app.route("/api/docs", docsRouter);
app.route("/api/share", shareRoutes);

// Health check
app.get("/health", (c) => {
	return c.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
	});
});

// Serve static assets for any non-API route
// This allows Next.js static export to be served
app.get("*", async (c) => {
	const url = new URL(c.req.url);
	const path = url.pathname;

	// Skip API routes
	if (path.startsWith("/api/")) {
		return c.json({ error: "Not found" }, 404);
	}

	// For static files, serve from assets
	try {
		// Try to get the file from assets binding
		const asset = await c.env.ASSETS.fetch(
			new Request(new URL(path, c.req.url)),
		);

		if (asset && asset.status !== 404) {
			// Add cache headers for static assets
			return addStaticCacheHeaders(asset, path);
		}

		// For non-API routes, serve index.html (SPA fallback)
		const indexAsset = await c.env.ASSETS.fetch(
			new Request(new URL("/index.html", c.req.url)),
		);

		if (indexAsset) {
			return addStaticCacheHeaders(indexAsset, "/index.html");
		}

		return c.json({ error: "Not found" }, 404);
	} catch {
		return c.json({ error: "Not found" }, 404);
	}
});

export default app;
