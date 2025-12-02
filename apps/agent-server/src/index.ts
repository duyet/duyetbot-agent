/**
 * Agent Server
 *
 * Long-running agent server with HTTP API and WebSocket support
 */

export type { ServerConfig } from './config';
export { getDefaultConfig, loadConfig, validateConfig } from './config';
export type { AgentRoutesConfig } from './routes/index';
export { createAgentRoutes, createHealthRoutes } from './routes/index';
// SDK adapter exports
export {
  createQueryController,
  executeQuery,
  streamQuery,
  toSDKTool,
  toSDKTools,
} from './sdk-adapter';
export type { ServerInstance } from './server';
export { main, startServer } from './server';
export type {
  AgentSession,
  CreateSessionInput,
  ListSessionsOptions,
  SessionState,
  UpdateSessionInput,
} from './session-manager';
export { AgentSessionManager } from './session-manager';
export type { WebSocketConfig, WebSocketMessage, WebSocketResponse } from './websocket';
export { AgentWebSocketServer, createWebSocketServer } from './websocket';
