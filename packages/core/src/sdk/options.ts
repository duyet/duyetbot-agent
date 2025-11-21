/**
 * SDK Options
 *
 * Configuration options for SDK query execution
 */

import type {
  MCPServerConfig,
  ModelType,
  PermissionMode,
  SDKTool,
  SubagentConfig,
} from './types.js';

/**
 * Query options for SDK execution
 */
export interface QueryOptions {
  /**
   * Model to use (haiku, sonnet, opus, or full model ID)
   */
  model?: ModelType;

  /**
   * Tools available to the agent
   */
  tools?: SDKTool[];

  /**
   * System prompt for the agent
   */
  systemPrompt?: string;

  /**
   * Permission mode for tool execution
   * - 'default': Standard permissions (ask for approval)
   * - 'acceptEdits': Auto-approve file edits
   * - 'bypassPermissions': Skip all permission checks (testing only)
   */
  permissionMode?: PermissionMode;

  /**
   * MCP server connections
   */
  mcpServers?: MCPServerConfig[];

  /**
   * Subagent definitions
   */
  agents?: SubagentConfig[];

  /**
   * Session ID to use or resume
   */
  sessionId?: string;

  /**
   * Resume from existing session
   */
  resume?: string;

  /**
   * Fork from existing session to create new branch
   */
  forkSession?: string;

  /**
   * Maximum tokens to generate
   */
  maxTokens?: number;

  /**
   * Temperature for response generation
   */
  temperature?: number;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Custom metadata to attach to the session
   */
  metadata?: Record<string, unknown>;
}

/**
 * Create default options with sensible defaults
 */
export function createDefaultOptions(overrides?: Partial<QueryOptions>): QueryOptions {
  return {
    model: 'sonnet',
    permissionMode: 'default',
    maxTokens: 8192,
    temperature: 0.7,
    timeout: 300000, // 5 minutes
    ...overrides,
  };
}

/**
 * Merge options with defaults
 */
export function mergeOptions(
  defaults: QueryOptions,
  overrides?: Partial<QueryOptions>
): QueryOptions {
  return {
    ...defaults,
    ...overrides,
    // Deep merge for nested objects
    metadata: {
      ...defaults.metadata,
      ...overrides?.metadata,
    },
    // Concatenate arrays
    tools: [...(defaults.tools || []), ...(overrides?.tools || [])],
    mcpServers: [...(defaults.mcpServers || []), ...(overrides?.mcpServers || [])],
    agents: [...(defaults.agents || []), ...(overrides?.agents || [])],
  };
}

/**
 * Validate options
 */
export function validateOptions(options: QueryOptions): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate model
  if (options.model && typeof options.model !== 'string') {
    errors.push('Model must be a string');
  }

  // Validate permission mode
  const validModes = ['default', 'acceptEdits', 'bypassPermissions'];
  if (options.permissionMode && !validModes.includes(options.permissionMode)) {
    errors.push(`Invalid permission mode: ${options.permissionMode}`);
  }

  // Validate temperature
  if (options.temperature !== undefined) {
    if (options.temperature < 0 || options.temperature > 2) {
      errors.push('Temperature must be between 0 and 2');
    }
  }

  // Validate max tokens
  if (options.maxTokens !== undefined && options.maxTokens < 1) {
    errors.push('Max tokens must be at least 1');
  }

  // Validate timeout
  if (options.timeout !== undefined && options.timeout < 0) {
    errors.push('Timeout must be non-negative');
  }

  // Validate MCP servers
  if (options.mcpServers) {
    for (const server of options.mcpServers) {
      if (!server.type) {
        errors.push('MCP server must have a type');
      }
      if (server.type === 'http' && !server.url) {
        errors.push('HTTP MCP server must have a URL');
      }
      if (server.type === 'stdio' && !server.command) {
        errors.push('Stdio MCP server must have a command');
      }
    }
  }

  // Validate subagents
  if (options.agents) {
    for (const agent of options.agents) {
      if (!agent.name) {
        errors.push('Subagent must have a name');
      }
      if (!agent.description) {
        errors.push('Subagent must have a description');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
