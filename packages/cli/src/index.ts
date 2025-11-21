/**
 * CLI Package Exports
 */

export type { CLIConfig, ProviderConfig, AuthConfig } from './config.js';
export {
  getDefaultConfig,
  loadConfig,
  saveConfig,
  updateConfig,
  getConfigDir,
  getConfigPath,
} from './config.js';

export type { AuthUser, AuthCredentials, AuthState } from './auth.js';
export { AuthManager } from './auth.js';

export type {
  LocalSession,
  SessionState,
  CreateSessionInput,
  UpdateSessionInput,
  ListSessionsOptions,
} from './sessions.js';
export { FileSessionManager } from './sessions.js';

export { CloudSessionManager } from './cloud-sessions.js';

export type { ChatOptions, ChatContext } from './chat.js';
export { startChat, runPrompt } from './chat.js';

export { startInkChat } from './chat-ink.js';

export type {
  ChatViewProps,
  StatusBarProps,
  AppProps,
  SessionItem,
  SessionListProps,
} from './ui/index.js';
export {
  ChatView,
  StatusBar,
  App,
  SessionList,
  SessionListHeader,
  SessionListView,
} from './ui/index.js';

export type { DeviceCodeResponse, AccessTokenResponse } from './oauth.js';
export { GitHubDeviceAuth, startDeviceLogin } from './oauth.js';

export type { ModeDetectionResult } from './mode-detector.js';
export { checkMCPServer, detectMode, getEffectiveMode } from './mode-detector.js';
