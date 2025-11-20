/**
 * CLI Package Exports
 */

export type { CLIConfig, ProviderConfig, AuthConfig } from './config.js';
export { getDefaultConfig, loadConfig, saveConfig, updateConfig, getConfigDir, getConfigPath } from './config.js';

export type { AuthUser, AuthCredentials, AuthState } from './auth.js';
export { AuthManager } from './auth.js';

export type { LocalSession, SessionState, CreateSessionInput, UpdateSessionInput, ListSessionsOptions } from './sessions.js';
export { FileSessionManager } from './sessions.js';
