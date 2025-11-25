/**
 * Type definitions for the prompts package
 *
 * Provides TypeScript interfaces for prompt configuration,
 * tool definitions, and platform types.
 */

/**
 * Supported platforms for prompt customization
 */
export type Platform = 'telegram' | 'github' | 'api' | 'cli';

/**
 * Tool definition for prompt tool sections
 */
export interface ToolDefinition {
  /** Tool name/identifier */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
}

/**
 * Configuration for prompt building
 */
export interface PromptConfig {
  /** Bot name (e.g., '@duyetbot') */
  botName: string;
  /** Creator name (e.g., 'Duyet Le') */
  creator: string;
  /** Target platform for platform-specific formatting */
  platform?: Platform;
  /** Available tools to include in prompt */
  tools?: ToolDefinition[];
  /** Capabilities to list in the prompt */
  capabilities?: string[];
}

/**
 * Section render function type
 * Takes config and returns rendered section string
 */
export type SectionRenderer = (config: PromptConfig) => string;

/**
 * Custom section definition
 */
export interface CustomSection {
  /** Section name/tag (used in XML tags) */
  name: string;
  /** Section content */
  content: string;
}
