/**
 * Prompt Builder
 *
 * Fluent API for composing prompts from reusable sections.
 * Supports method chaining for clean, declarative prompt construction.
 *
 * @example
 * ```typescript
 * const prompt = createPrompt({ botName: '@duyetbot' })
 *   .withIdentity()
 *   .withPolicy()
 *   .withTools([{ name: 'search', description: 'Web search' }])
 *   .withGuidelines()
 *   .forTelegram()
 *   .build();
 * ```
 */
import type { OutputFormat, Platform, PromptConfig, ToolDefinition } from './types.js';
/**
 * PromptBuilder class for fluent prompt composition
 */
export declare class PromptBuilder {
  private sections;
  private builderConfig;
  private customSections;
  constructor(config?: Partial<PromptConfig>);
  /**
   * Get config as PromptConfig (for section renderers)
   */
  private get config();
  /**
   * Add bot identity section
   * "You are {botName}, created by {creator}..."
   */
  withIdentity(): this;
  /**
   * Add core safety policy section
   * Highest precedence rules for safety and behavior
   */
  withPolicy(): this;
  /**
   * Add capabilities section
   * @param capabilities - Override config capabilities, or use config default
   */
  withCapabilities(capabilities?: string[]): this;
  /**
   * Add tools section listing available tools
   * @param tools - Override config tools, or use config default
   */
  withTools(tools?: ToolDefinition[]): this;
  /**
   * Add response guidelines section
   * Formatting and communication style guidance
   */
  withGuidelines(): this;
  /**
   * Set output format for response formatting (platform-neutral)
   *
   * This is the preferred way to set formatting for shared agents that
   * may be used across multiple platforms. Maps to platform-specific
   * settings internally.
   *
   * @param format - Output format: 'telegram-html', 'telegram-markdown', 'github-markdown', or 'plain'
   *
   * @example
   * ```typescript
   * // Shared agent can use output format at runtime
   * getDuyetInfoPrompt({ outputFormat: 'telegram-html' });
   * getDuyetInfoPrompt({ outputFormat: 'github-markdown' });
   * ```
   */
  withOutputFormat(format: OutputFormat): this;
  /**
   * Add coding standards section
   * Best practices for code generation
   */
  withCodingStandards(): this;
  /**
   * Add history context handling section
   * Instructions for handling conversation history
   */
  withHistoryContext(): this;
  /**
   * Add a custom section with arbitrary content
   * @param name - Section name (used in XML tags)
   * @param content - Section content
   */
  withCustomSection(name: string, content: string): this;
  /**
   * Add raw content without wrapping
   * Use for content that doesn't fit standard sections
   */
  withRaw(content: string): this;
  /**
   * Apply Telegram-specific formatting
   * Sets platform and adds mobile-optimized guidelines
   */
  forTelegram(): this;
  /**
   * Apply GitHub-specific formatting
   * Sets platform and adds code-focused guidelines
   */
  forGitHub(): this;
  /**
   * Apply API-specific formatting
   */
  forAPI(): this;
  /**
   * Apply CLI-specific formatting
   */
  forCLI(): this;
  /**
   * Set platform directly
   */
  forPlatform(platform: Platform): this;
  /**
   * Get the current config (useful for debugging)
   */
  getConfig(): PromptConfig;
  /**
   * Build the final prompt string
   * Combines all sections with proper spacing
   */
  build(): string;
}
/**
 * Factory function for creating a PromptBuilder
 * @param config - Optional configuration overrides
 */
export declare function createPrompt(config?: Partial<PromptConfig>): PromptBuilder;
//# sourceMappingURL=builder.d.ts.map
