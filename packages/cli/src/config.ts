/**
 * CLI Configuration
 *
 * Manages CLI configuration and settings
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface ProviderConfig {
  type: 'anthropic' | 'openai' | 'openrouter';
  apiKey: string;
  baseUrl?: string;
  models?: Record<string, string>;
}

export interface AuthConfig {
  githubToken?: string;
  sessionToken?: string;
  expiresAt?: number;
}

export interface CLIConfig {
  defaultProvider: string;
  mode: 'local' | 'cloud';
  mcpServerUrl?: string;
  sessionsDir: string;
  providers: Record<string, ProviderConfig>;
  auth?: AuthConfig;
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): CLIConfig {
  const homeDir = os.homedir();
  return {
    defaultProvider: 'claude',
    mode: 'local',
    sessionsDir: path.join(homeDir, '.duyetbot', 'sessions'),
    providers: {},
  };
}

/**
 * Get config directory path
 */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.duyetbot');
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * Load configuration from file
 */
export function loadConfig(): CLIConfig {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return getDefaultConfig();
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const loaded = JSON.parse(content);
    return { ...getDefaultConfig(), ...loaded };
  } catch {
    return getDefaultConfig();
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: CLIConfig): void {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Update specific config fields
 */
export function updateConfig(updates: Partial<CLIConfig>): CLIConfig {
  const current = loadConfig();
  const updated = { ...current, ...updates };
  saveConfig(updated);
  return updated;
}
