/**
 * Server Configuration
 *
 * Configuration management for the agent server
 */

export interface ServerConfig {
  port: number;
  host: string;
  wsPort: number;
  env: 'development' | 'production' | 'test';
  mcpServerUrl?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): ServerConfig {
  return {
    port: 3000,
    host: '0.0.0.0',
    wsPort: 8080,
    env: 'development',
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): ServerConfig {
  const defaults = getDefaultConfig();

  const config: ServerConfig = {
    port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : defaults.port,
    host: process.env.HOST || defaults.host,
    wsPort: process.env.WS_PORT ? Number.parseInt(process.env.WS_PORT, 10) : defaults.wsPort,
    env: (process.env.NODE_ENV as ServerConfig['env']) || defaults.env,
  };

  // Only set optional properties if they have values
  if (process.env.MCP_SERVER_URL) {
    config.mcpServerUrl = process.env.MCP_SERVER_URL;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.OPENAI_API_KEY) {
    config.openaiApiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.OPENROUTER_API_KEY) {
    config.openrouterApiKey = process.env.OPENROUTER_API_KEY;
  }

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config: ServerConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error('Invalid port: must be between 1 and 65535');
  }

  if (config.wsPort < 1 || config.wsPort > 65535) {
    throw new Error('Invalid WebSocket port: must be between 1 and 65535');
  }

  if (!config.host || config.host.length === 0) {
    throw new Error('Invalid host: cannot be empty');
  }
}
