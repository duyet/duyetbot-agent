/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Workers Entry Point
 *
 * This is the main entry point for the duyetbot-agent running on Cloudflare Workers.
 * It handles HTTP requests, manages task execution, and provides the API for the web UI.
 */

export interface Env {
  // KV Namespaces
  TASKS: KVNamespace;
  SESSIONS: KVNamespace;

  // D1 Database
  DB: D1Database;

  // Secrets
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  OPENROUTER_API_KEY: string;
  AUTH_SECRET: string;

  // Environment
  ENVIRONMENT: 'production' | 'staging' | 'development';
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // API routes will be implemented here
    if (url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'Not implemented',
          message: 'API endpoints are under development',
        }),
        {
          status: 501,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // UI routes will be implemented here
    return new Response(
      JSON.stringify({
        name: 'duyetbot-agent',
        version: '0.1.0',
        description: 'Autonomous bot agent system with multi-LLM support',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },

  // Scheduled trigger for cron jobs
  async scheduled(event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
    console.log('Scheduled event triggered:', event.scheduledTime);
    // Scheduler implementation will go here
  },
};
