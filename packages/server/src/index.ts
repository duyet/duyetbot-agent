/**
 * Agent Server
 *
 * Long-running agent server with HTTP API and WebSocket support
 */

export type { ServerConfig } from './config';
export { loadConfig, validateConfig, getDefaultConfig } from './config';
export { AgentSessionManager } from './session-manager';
export type {
  AgentSession,
  SessionState,
  CreateSessionInput,
  UpdateSessionInput,
  ListSessionsOptions,
} from './session-manager';
export { createHealthRoutes, createAgentRoutes } from './routes/index';
export type { AgentRoutesConfig } from './routes/index';
export { createWebSocketServer, AgentWebSocketServer } from './websocket';
export type { WebSocketMessage, WebSocketResponse, WebSocketConfig } from './websocket';
export { startServer, main } from './server';
export type { ServerInstance } from './server';

// SDK adapter exports
export {
  toSDKTool,
  toSDKTools,
  executeQuery,
  streamQuery,
  createQueryController,
} from './sdk-adapter';
