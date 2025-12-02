/**
 * CLI Package Exports
 */

export type { AuthCredentials, AuthState, AuthUser } from './auth.js';
export { AuthManager } from './auth.js';
export type { ChatContext, ChatOptions } from './chat.js';
export { runPrompt, startChat } from './chat.js';
export { startInkChat } from './chat-ink.js';
export { CloudSessionManager } from './cloud-sessions.js';
export type { AuthConfig, CLIConfig, ProviderConfig } from './config.js';
export {
  getConfigDir,
  getConfigPath,
  getDefaultConfig,
  loadConfig,
  saveConfig,
  updateConfig,
} from './config.js';
export type { ModeDetectionResult } from './mode-detector.js';
export { checkMCPServer, detectMode, getEffectiveMode } from './mode-detector.js';
export type { AccessTokenResponse, DeviceCodeResponse } from './oauth.js';
export { GitHubDeviceAuth, startDeviceLogin } from './oauth.js';
export type {
  CreateSessionInput,
  ListSessionsOptions,
  LocalSession,
  SessionState,
  UpdateSessionInput,
} from './sessions.js';
export { FileSessionManager } from './sessions.js';
export type {
  AppProps,
  ChatViewProps,
  SessionItem,
  SessionListProps,
  StatusBarProps,
} from './ui/index.js';
export {
  App,
  ChatView,
  SessionList,
  SessionListHeader,
  SessionListView,
  StatusBar,
} from './ui/index.js';
