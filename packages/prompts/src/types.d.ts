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
 * Output format for response formatting (platform-neutral abstraction)
 *
 * This is the primary way to specify formatting for prompts.
 * Maps to specific formatting instructions without coupling to platform names.
 *
 * @example
 * ```typescript
 * // Use in prompt functions
 * getTelegramPrompt({ outputFormat: 'telegram-html' });
 * getDuyetInfoPrompt({ outputFormat: 'github-markdown' });
 *
 * // Or with the builder
 * createPrompt().withOutputFormat('telegram-html').build();
 * ```
 */
export type OutputFormat = 'telegram-html' | 'telegram-markdown' | 'github-markdown' | 'plain';
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
  /** Output format for response formatting (platform-neutral) */
  outputFormat?: OutputFormat;
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
//# sourceMappingURL=types.d.ts.map
