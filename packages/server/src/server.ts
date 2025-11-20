/**
 * Main Server Entry Point
 *
 * Starts HTTP and WebSocket servers with graceful shutdown
 */

import { createServer } from 'node:http';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { loadConfig, validateConfig } from './config.js';
import { AgentSessionManager } from './session-manager.js';
import { createHealthRoutes, createAgentRoutes } from './routes/index.js';
import { createWebSocketServer, type AgentWebSocketServer } from './websocket.js';

export interface ServerInstance {
  httpServer: ReturnType<typeof serve>;
  wsServer: AgentWebSocketServer;
  sessionManager: AgentSessionManager;
  shutdown: () => Promise<void>;
}

/**
 * Create and start the server
 */
export async function startServer(): Promise<ServerInstance> {
  // Load and validate configuration
  const config = loadConfig();
  validateConfig(config);

  // Create session manager
  const sessionManager = new AgentSessionManager();

  // Create Hono app
  const app = new Hono();

  // Mount routes
  app.route('/health', createHealthRoutes());
  app.route('/agent', createAgentRoutes(sessionManager));

  // Create HTTP server with Hono
  const httpServer = serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  });

  // Create separate WebSocket server
  const wsHttpServer = createServer();
  const wsServer = createWebSocketServer(wsHttpServer, sessionManager);

  // Start WebSocket server
  wsHttpServer.listen(config.wsPort, config.host, () => {
    console.log(`WebSocket server listening on ws://${config.host}:${config.wsPort}`);
  });

  console.log(`HTTP server listening on http://${config.host}:${config.port}`);

  // Graceful shutdown handler
  const shutdown = async (): Promise<void> => {
    console.log('Shutting down gracefully...');

    // Close WebSocket connections
    wsServer.close();
    console.log('WebSocket server closed');

    // Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        console.log('HTTP server closed');
        resolve();
      });
    });

    // Close WebSocket HTTP server
    await new Promise<void>((resolve) => {
      wsHttpServer.close(() => {
        console.log('WebSocket HTTP server closed');
        resolve();
      });
    });

    // Cleanup sessions
    sessionManager.clear();
    console.log('Sessions cleared');

    console.log('Shutdown complete');
  };

  return {
    httpServer,
    wsServer,
    sessionManager,
    shutdown,
  };
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  const server = await startServer();

  // Handle shutdown signals
  const handleShutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}`);
    await server.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    server.shutdown().then(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    server.shutdown().then(() => process.exit(1));
  });
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
