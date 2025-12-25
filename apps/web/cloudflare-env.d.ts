interface CloudflareEnv {
  AI: Ai;
  DB: D1Database;
  UPLOADS_BUCKET: R2Bucket;
  SESSION_SECRET: string;
  AI_GATEWAY_API_KEY: string;
  AI_GATEWAY_NAME: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  AUTH_KV?: KVNamespace;
}
