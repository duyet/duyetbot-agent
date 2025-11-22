import { serve } from '@hono/node-server';
import type { Hono } from 'hono';

export interface TestServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

/**
 * Start a test server on a random available port
 */
export async function startTestServer(
  app: Hono,
  options: { port?: number } = {}
): Promise<TestServer> {
  const port = options.port || (3000 + Math.floor(Math.random() * 1000));

  const server = serve({
    fetch: app.fetch,
    port,
  });

  return {
    url: `http://localhost:${port}`,
    port,
    close: async () => {
      return new Promise((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a mock WebSocket client for testing
 */
export function createWebSocketClient(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (err) => reject(err);
  });
}
