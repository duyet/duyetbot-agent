/**
 * UI Configuration
 *
 * Centralized configuration for terminal UI
 */

export interface UIConfig {
  // Provider settings
  defaultProvider: 'claude' | 'openrouter';
  defaultModel: string;

  // Storage settings
  storagePath?: string;

  // UI settings
  appName: string;
  version: string;

  // Session settings
  defaultSessionTitle: string;

  // Keyboard shortcuts
  shortcuts: {
    exit: string;
    clear: string;
    newSession: string;
  };
}

export const defaultConfig: UIConfig = {
  defaultProvider: 'claude',
  defaultModel: 'claude-3-5-sonnet-20241022',
  appName: 'duyetbot',
  version: '0.1.0',
  defaultSessionTitle: 'New Chat',
  shortcuts: {
    exit: 'Ctrl+C',
    clear: 'Ctrl+L',
    newSession: 'Ctrl+N',
  },
};
