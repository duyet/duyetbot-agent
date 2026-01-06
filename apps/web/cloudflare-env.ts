import type { Ai } from "@cloudflare/workers-types";
import type { D1Database, R2Bucket, KVNamespace } from "@cloudflare/workers-types";

export interface CloudflareEnv extends Record<string, unknown> {
	AI: Ai;
	DB: D1Database;
	UPLOADS_BUCKET: R2Bucket;
	R2_PUBLIC_URL?: string;
	SESSION_SECRET: string;
	AI_GATEWAY_API_KEY: string;
	AI_GATEWAY_NAME: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	AUTH_KV?: KVNamespace;
}

// Global augmentation for Next.js to recognize CloudflareEnv
declare global {
	namespace NodeJS {
		interface ProcessEnv {
		// Add any Node.js env vars here if needed
	}
	}
}

export {}; // Ensure this file is treated as a module
