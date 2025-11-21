/**
 * Agent Server
 *
 * Long-running agent server with HTTP API and WebSocket support
 */

export type { ServerConfig } from './config.js';
export { loadConfig, validateConfig, getDefaultConfig } from './config.js';
export { AgentSessionManager } from './session-manager.js';
export type {
  AgentSession,
  SessionState,
  CreateSessionInput,
  UpdateSessionInput,
  ListSessionsOptions,
} from './session-manager.js';
export { createHealthRoutes, createAgentRoutes } from './routes/index.js';
export type { AgentRoutesConfig } from './routes/index.js';
export { createWebSocketServer, AgentWebSocketServer } from './websocket.js';
export type { WebSocketMessage, WebSocketResponse, WebSocketConfig } from './websocket.js';
export { startServer, main } from './server.js';
export type { ServerInstance } from './server.js';

// SDK adapter exports
export { toSDKTool, toSDKTools, executeQuery, streamQuery, createQueryController } from './sdk-adapter.js';
