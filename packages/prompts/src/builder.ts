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
import type {
  CustomSection,
  Platform,
  PromptConfig,
  TelegramParseMode,
  ToolDefinition,
} from './types.js';

/**
 * Internal builder config with required fields
 */
interface BuilderConfig {
  botName: string;
  creator: string;
  platform: Platform | undefined;
  tools: ToolDefinition[];
  capabilities: string[];
  telegramParseMode: TelegramParseMode;
}

/**
 * PromptBuilder class for fluent prompt composition
 */
export class PromptBuilder {
  private sections: string[] = [];
  private builderConfig: BuilderConfig;
  private customSections: CustomSection[] = [];

  constructor(config: Partial<PromptConfig> = {}) {
    this.builderConfig = {
      botName: config.botName ?? defaultConfig.botName,
      creator: config.creator ?? defaultConfig.creator,
      platform: config.platform,
      tools: config.tools ?? [],
      capabilities: config.capabilities ?? [],
      telegramParseMode: config.telegramParseMode ?? 'HTML',
    };
  }

  /**
   * Get config as PromptConfig (for section renderers)
   */
  private get config(): PromptConfig {
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
  withIdentity(): this {
    this.sections.push(identitySection(this.config));
    return this;
  }

  /**
   * Add core safety policy section
   * Highest precedence rules for safety and behavior
   */
  withPolicy(): this {
    this.sections.push(policySection());
    return this;
  }

  /**
   * Add capabilities section
   * @param capabilities - Override config capabilities, or use config default
   */
  withCapabilities(capabilities?: string[]): this {
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
  withTools(tools?: ToolDefinition[]): this {
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
  withGuidelines(): this {
    this.sections.push(
      guidelinesSection(this.builderConfig.platform, this.builderConfig.telegramParseMode)
    );
    return this;
  }

  /**
   * Set Telegram parse mode for response formatting
   * @param mode - 'HTML' (default) or 'MarkdownV2'
   */
  withTelegramParseMode(mode: TelegramParseMode): this {
    this.builderConfig.telegramParseMode = mode;
    return this;
  }

  /**
   * Add coding standards section
   * Best practices for code generation
   */
  withCodingStandards(): this {
    this.sections.push(codingStandardsSection());
    return this;
  }

  /**
   * Add history context handling section
   * Instructions for handling conversation history
   */
  withHistoryContext(): this {
    this.sections.push(historyContextSection());
    return this;
  }

  /**
   * Add a custom section with arbitrary content
   * @param name - Section name (used in XML tags)
   * @param content - Section content
   */
  withCustomSection(name: string, content: string): this {
    this.customSections.push({ name, content });
    return this;
  }

  /**
   * Add raw content without wrapping
   * Use for content that doesn't fit standard sections
   */
  withRaw(content: string): this {
    this.sections.push(content);
    return this;
  }

  /**
   * Apply Telegram-specific formatting
   * Sets platform and adds mobile-optimized guidelines
   */
  forTelegram(): this {
    this.builderConfig.platform = 'telegram';
    return this;
  }

  /**
   * Apply GitHub-specific formatting
   * Sets platform and adds code-focused guidelines
   */
  forGitHub(): this {
    this.builderConfig.platform = 'github';
    return this;
  }

  /**
   * Apply API-specific formatting
   */
  forAPI(): this {
    this.builderConfig.platform = 'api';
    return this;
  }

  /**
   * Apply CLI-specific formatting
   */
  forCLI(): this {
    this.builderConfig.platform = 'cli';
    return this;
  }

  /**
   * Set platform directly
   */
  forPlatform(platform: Platform): this {
    this.builderConfig.platform = platform;
    return this;
  }

  /**
   * Get the current config (useful for debugging)
   */
  getConfig(): PromptConfig {
    return { ...this.config };
  }

  /**
   * Build the final prompt string
   * Combines all sections with proper spacing
   */
  build(): string {
    const parts: string[] = [...this.sections];

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
export function createPrompt(config?: Partial<PromptConfig>): PromptBuilder {
  return new PromptBuilder(config);
}
