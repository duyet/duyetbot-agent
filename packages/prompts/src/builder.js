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
import { config as defaultConfig } from './config.js';
import {
  capabilitiesSection,
  codingStandardsSection,
  guidelinesSection,
  historyContextSection,
  identitySection,
  policySection,
  toolsSection,
} from './sections/index.js';
/**
 * PromptBuilder class for fluent prompt composition
 */
export class PromptBuilder {
  sections = [];
  builderConfig;
  customSections = [];
  constructor(config = {}) {
    this.builderConfig = {
      botName: config.botName ?? defaultConfig.botName,
      creator: config.creator ?? defaultConfig.creator,
      platform: config.platform,
      tools: config.tools ?? [],
      capabilities: config.capabilities ?? [],
      outputFormat: config.outputFormat,
    };
  }
  /**
   * Get config as PromptConfig (for section renderers)
   */
  get config() {
    return {
      botName: this.builderConfig.botName,
      creator: this.builderConfig.creator,
      ...(this.builderConfig.platform && {
        platform: this.builderConfig.platform,
      }),
      ...(this.builderConfig.tools.length > 0 && {
        tools: this.builderConfig.tools,
      }),
      ...(this.builderConfig.capabilities.length > 0 && {
        capabilities: this.builderConfig.capabilities,
      }),
    };
  }
  /**
   * Add bot identity section
   * "You are {botName}, created by {creator}..."
   */
  withIdentity() {
    this.sections.push(identitySection(this.config));
    return this;
  }
  /**
   * Add core safety policy section
   * Highest precedence rules for safety and behavior
   */
  withPolicy() {
    this.sections.push(policySection());
    return this;
  }
  /**
   * Add capabilities section
   * @param capabilities - Override config capabilities, or use config default
   */
  withCapabilities(capabilities) {
    const caps = capabilities ?? this.builderConfig.capabilities;
    if (caps.length > 0) {
      this.sections.push(capabilitiesSection(caps));
    }
    return this;
  }
  /**
   * Add tools section listing available tools
   * @param tools - Override config tools, or use config default
   */
  withTools(tools) {
    const toolList = tools ?? this.builderConfig.tools;
    if (toolList.length > 0) {
      this.sections.push(toolsSection(toolList));
    }
    return this;
  }
  /**
   * Add response guidelines section
   * Formatting and communication style guidance
   */
  withGuidelines() {
    this.sections.push(guidelinesSection(this.builderConfig.outputFormat));
    return this;
  }
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
  withOutputFormat(format) {
    this.builderConfig.outputFormat = format;
    // Map output format to platform for platform tag
    switch (format) {
      case 'telegram-html':
      case 'telegram-markdown':
        this.builderConfig.platform = 'telegram';
        break;
      case 'github-markdown':
        this.builderConfig.platform = 'github';
        break;
      case 'plain':
        // No platform-specific formatting
        this.builderConfig.platform = undefined;
        break;
    }
    return this;
  }
  /**
   * Add coding standards section
   * Best practices for code generation
   */
  withCodingStandards() {
    this.sections.push(codingStandardsSection());
    return this;
  }
  /**
   * Add history context handling section
   * Instructions for handling conversation history
   */
  withHistoryContext() {
    this.sections.push(historyContextSection());
    return this;
  }
  /**
   * Add a custom section with arbitrary content
   * @param name - Section name (used in XML tags)
   * @param content - Section content
   */
  withCustomSection(name, content) {
    this.customSections.push({ name, content });
    return this;
  }
  /**
   * Add raw content without wrapping
   * Use for content that doesn't fit standard sections
   */
  withRaw(content) {
    this.sections.push(content);
    return this;
  }
  /**
   * Apply Telegram-specific formatting
   * Sets platform and adds mobile-optimized guidelines
   */
  forTelegram() {
    this.builderConfig.platform = 'telegram';
    return this;
  }
  /**
   * Apply GitHub-specific formatting
   * Sets platform and adds code-focused guidelines
   */
  forGitHub() {
    this.builderConfig.platform = 'github';
    return this;
  }
  /**
   * Apply API-specific formatting
   */
  forAPI() {
    this.builderConfig.platform = 'api';
    return this;
  }
  /**
   * Apply CLI-specific formatting
   */
  forCLI() {
    this.builderConfig.platform = 'cli';
    return this;
  }
  /**
   * Set platform directly
   */
  forPlatform(platform) {
    this.builderConfig.platform = platform;
    return this;
  }
  /**
   * Get the current config (useful for debugging)
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Build the final prompt string
   * Combines all sections with proper spacing
   */
  build() {
    const parts = [...this.sections];
    // Add custom sections
    for (const { name, content } of this.customSections) {
      parts.push(`<${name}>\n${content.trim()}\n</${name}>`);
    }
    // Add platform tag if set
    if (this.builderConfig.platform) {
      parts.push(`<platform>${this.builderConfig.platform}</platform>`);
    }
    return parts.filter((s) => s.trim()).join('\n\n');
  }
}
/**
 * Factory function for creating a PromptBuilder
 * @param config - Optional configuration overrides
 */
export function createPrompt(config) {
  return new PromptBuilder(config);
}
