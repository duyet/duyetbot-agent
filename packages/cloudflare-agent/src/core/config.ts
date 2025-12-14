/**
 * Core configuration types and defaults for CloudflareAgent
 *
 * This module provides configuration types, default values, and validation helpers
 * for the CloudflareAgent system. It centralizes all configuration-related logic
 * to ensure consistency across the codebase.
 *
 * @module core/config
 */

import type { CloudflareAgentConfig } from './types.js';

/**
 * Default configuration values for CloudflareAgent
 *
 * These values are applied when configuration options are not explicitly provided.
 * They represent production-tested defaults optimized for typical use cases.
 */
export const DEFAULT_CONFIG = {
  /** Maximum messages to keep in conversation history (prevents memory overflow) */
  maxHistory: 100,

  /** Maximum tool call iterations per message (prevents infinite loops) */
  maxToolIterations: 5,

  /** Interval in milliseconds to rotate thinking messages during processing */
  thinkingRotationInterval: 5000,

  /** Maximum number of tools to expose to LLM (undefined = unlimited) */
  maxTools: undefined as number | undefined,

  /** Default welcome message for /start command */
  welcomeMessage: 'Welcome! How can I help you today?',

  /** Default help message for /help command */
  helpMessage: 'Available commands: /start, /help, /clear, /debug, /status',
} as const;

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validates a configuration value is a positive integer
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ConfigValidationError} If value is not a positive integer
 */
export function validatePositiveInteger(value: unknown, fieldName: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ConfigValidationError(
      `${fieldName} must be a positive integer, got: ${value}`,
      fieldName
    );
  }
}

/**
 * Validates a configuration value is a non-negative integer
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ConfigValidationError} If value is not a non-negative integer
 */
export function validateNonNegativeInteger(value: unknown, fieldName: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ConfigValidationError(
      `${fieldName} must be a non-negative integer, got: ${value}`,
      fieldName
    );
  }
}

/**
 * Validates a configuration value is a non-empty string
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ConfigValidationError} If value is not a non-empty string
 */
export function validateNonEmptyString(value: unknown, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ConfigValidationError(
      `${fieldName} must be a non-empty string, got: ${value}`,
      fieldName
    );
  }
}

/**
 * Validates core numeric configuration values
 *
 * @param config - Configuration to validate
 * @throws {ConfigValidationError} If any value is invalid
 */
export function validateNumericConfig<TEnv, TContext>(
  config: Partial<CloudflareAgentConfig<TEnv, TContext>>
): void {
  if (config.maxHistory !== undefined) {
    validatePositiveInteger(config.maxHistory, 'maxHistory');
  }

  if (config.maxToolIterations !== undefined) {
    validatePositiveInteger(config.maxToolIterations, 'maxToolIterations');
  }

  if (config.thinkingRotationInterval !== undefined) {
    validatePositiveInteger(config.thinkingRotationInterval, 'thinkingRotationInterval');
  }

  if (config.maxTools !== undefined) {
    validatePositiveInteger(config.maxTools, 'maxTools');
  }
}

/**
 * Validates required configuration fields
 *
 * @param config - Configuration to validate
 * @throws {ConfigValidationError} If required fields are missing
 */
export function validateRequiredConfig<TEnv, TContext>(
  config: CloudflareAgentConfig<TEnv, TContext>
): void {
  if (!config.createProvider) {
    throw new ConfigValidationError('createProvider is required', 'createProvider');
  }

  if (!config.systemPrompt) {
    throw new ConfigValidationError('systemPrompt is required', 'systemPrompt');
  }

  if (typeof config.systemPrompt === 'string') {
    validateNonEmptyString(config.systemPrompt, 'systemPrompt');
  }
}

/**
 * Validates MCP server configuration
 *
 * @param servers - MCP server connections to validate
 * @throws {ConfigValidationError} If server configuration is invalid
 */
export function validateMCPServers(
  servers: Array<{ name: string; url: string }> | undefined
): void {
  if (!servers) return;

  const names = new Set<string>();

  for (const server of servers) {
    validateNonEmptyString(server.name, 'mcpServer.name');
    validateNonEmptyString(server.url, 'mcpServer.url');

    // Check for duplicate names
    if (names.has(server.name)) {
      throw new ConfigValidationError(`Duplicate MCP server name: ${server.name}`, 'mcpServers');
    }
    names.add(server.name);

    // Validate URL format
    try {
      new URL(server.url);
    } catch {
      throw new ConfigValidationError(`Invalid MCP server URL: ${server.url}`, 'mcpServers');
    }
  }
}

/**
 * Applies default values to configuration
 *
 * @param config - Configuration with optional values
 * @returns Configuration with defaults applied
 */
export function applyConfigDefaults<TEnv, TContext>(
  config: CloudflareAgentConfig<TEnv, TContext>
): Required<
  Pick<
    CloudflareAgentConfig<TEnv, TContext>,
    'maxHistory' | 'maxToolIterations' | 'thinkingRotationInterval'
  >
> &
  CloudflareAgentConfig<TEnv, TContext> {
  return {
    ...config,
    maxHistory: config.maxHistory ?? DEFAULT_CONFIG.maxHistory,
    maxToolIterations: config.maxToolIterations ?? DEFAULT_CONFIG.maxToolIterations,
    thinkingRotationInterval:
      config.thinkingRotationInterval ?? DEFAULT_CONFIG.thinkingRotationInterval,
  };
}

/**
 * Gets the system prompt from configuration
 *
 * Handles both static strings and dynamic functions that receive environment
 *
 * @param config - Agent configuration
 * @param env - Environment bindings
 * @returns Resolved system prompt string
 */
export function resolveSystemPrompt<TEnv, TContext>(
  config: CloudflareAgentConfig<TEnv, TContext>,
  env: TEnv
): string {
  return typeof config.systemPrompt === 'function' ? config.systemPrompt(env) : config.systemPrompt;
}

/**
 * Full configuration validation
 *
 * Validates all aspects of configuration including required fields,
 * numeric values, and MCP server configuration.
 *
 * @param config - Configuration to validate
 * @throws {ConfigValidationError} If configuration is invalid
 */
export function validateConfig<TEnv, TContext>(
  config: CloudflareAgentConfig<TEnv, TContext>
): void {
  validateRequiredConfig(config);
  validateNumericConfig(config);
  validateMCPServers(config.mcpServers);
}
