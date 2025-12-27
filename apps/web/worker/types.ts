import type { User } from "../lib/db/schema";

/**
 * Cloudflare Workers Environment Bindings
 */

export type Env = {
	// D1 Database
	DB: D1Database;

	// KV for rate limiting
	RATE_LIMIT_KV: KVNamespace;

	// R2 Storage
	UPLOADS_BUCKET: R2Bucket;

	// AI Binding
	AI: Ai;

	// Assets (Static files from Next.js export)
	ASSETS: Fetcher;

	// Environment Variables
	ENVIRONMENT: string;
	AI_GATEWAY_NAME: string;
	AI_GATEWAY_API_KEY?: string;
	SESSION_SECRET: string;
	R2_PUBLIC_URL?: string;

	// OAuth (GitHub)
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	GITHUB_TOKEN?: string;
};

/**
 * Hono Environment with bindings and context variables
 */
export type HonoEnv = {
	Bindings: Env;
	Variables: {
		user?: User;
	};
};
