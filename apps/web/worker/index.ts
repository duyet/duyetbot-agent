/**
 * Hono API Worker for duyetbot-web
 * Handles all API routes while Next.js static export serves the UI
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { WorkerError } from "./lib/errors";
// Import route handlers
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { documentRoutes } from "./routes/document";
import { filesRoutes } from "./routes/files";
import { historyRoutes } from "./routes/history";
import { suggestionsRoutes } from "./routes/suggestions";
import { voteRoutes } from "./routes/vote";
import type { Env } from "./types";

// Create Hono app with Cloudflare bindings
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use(
	"*",
	cors({
		origin: "*", // Configure appropriately for production
		credentials: true, // Keep during migration for cookie backward compatibility
		allowHeaders: ["Authorization", "Content-Type", "Cookie"],
	}),
);

// Global error handler - catches WorkerError and returns proper HTTP status
app.onError((err, c) => {
	const requestId = crypto.randomUUID().slice(0, 8);
	const path = new URL(c.req.url).pathname;
	const method = c.req.method;

	// Log error with context
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

	// For unexpected errors, return detailed debug info
	console.error(
		`[${requestId}] Unexpected error type: ${err.constructor.name}`,
	);

	// Return detailed error response for debugging
	return c.json(
		{
			error: "Internal server error",
			debug: {
				requestId,
				path,
				method,
				errorType: err.constructor.name,
				message: err.message,
				// Include stack trace for debugging (remove in production if needed)
				stack: err.stack?.split("\n").slice(0, 5).join("\n"), // First 5 lines of stack
			},
		},
		500,
	);
});

// API routes
app.route("/api/auth", authRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/history", historyRoutes);
app.route("/api/document", documentRoutes);
app.route("/api/files", filesRoutes);
app.route("/api/suggestions", suggestionsRoutes);
app.route("/api/vote", voteRoutes);

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
			return asset;
		}

		// For non-API routes, serve index.html (SPA fallback)
		const indexAsset = await c.env.ASSETS.fetch(
			new Request(new URL("/index.html", c.req.url)),
		);

		return indexAsset || c.json({ error: "Not found" }, 404);
	} catch {
		return c.json({ error: "Not found" }, 404);
	}
});

export default app;
