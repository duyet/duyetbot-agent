/**
 * PromptBuilder Provider for Promptfoo
 *
 * Wraps the existing PromptBuilder to generate prompts for evaluation.
 * Promptfoo will call these providers to get the system prompt.
 *
 * @example
 * ```yaml
 * providers:
 *   - id: prompt-builder:telegram-html
 *     config:
 *       platform: telegram
 *       outputFormat: telegram-html
 *       includeTools: false
 * ```
 */

import { createPrompt } from '../../packages/prompts/src/builder.js';
import type { OutputFormat, Platform, ToolDefinition } from '../../packages/prompts/src/types.js';

interface PromptBuilderConfig {
  platform?: Platform;
  outputFormat?: OutputFormat;
  includeTools?: boolean;
  capabilities?: string[];
}

interface ProviderContext {
  vars?: Record<string, unknown>;
}

interface ProviderResponse {
  output: string;
  tokenUsage?: { total: number; prompt: number; completion: number };
}

/**
 * Factory function to create a PromptBuilder provider
 */
export function createPromptBuilderProvider(config: PromptBuilderConfig) {
  return async (_prompt: string, _context: ProviderContext): Promise<ProviderResponse> => {
    const builder = createPrompt({ botName: '@duyetbot' })
      .withIdentity()
      .withPolicy()
      .withCapabilities(config.capabilities);

    // Platform-specific setup
    if (config.platform) {
      builder.forPlatform(config.platform);
    }

    // Apply output format if specified
    if (config.outputFormat) {
      builder.withOutputFormat(config.outputFormat);
    }

    // Add tools if requested
    if (config.includeTools) {
      const tools: ToolDefinition[] = [
        { name: 'bash', description: 'Execute shell commands' },
        { name: 'git', description: 'Git operations' },
        { name: 'web_search', description: 'Search the web for information' },
        { name: 'github', description: 'GitHub API operations' },
      ];
      builder.withTools(tools);
    }

    // Add guidelines for proper formatting
    builder.withGuidelines();

    const systemPrompt = builder.build();

    return {
      output: systemPrompt,
      tokenUsage: { total: 0, prompt: 0, completion: 0 },
    };
  };
}

/**
 * Named exports for promptfoo config references
 */

export const telegramHtml = createPromptBuilderProvider({
  platform: 'telegram',
  outputFormat: 'telegram-html',
  includeTools: false,
});

export const telegramMarkdownV2 = createPromptBuilderProvider({
  platform: 'telegram',
  outputFormat: 'telegram-markdown',
  includeTools: false,
});

export const githubMarkdown = createPromptBuilderProvider({
  platform: 'github',
  outputFormat: 'github-markdown',
  includeTools: true,
});

export const plainText = createPromptBuilderProvider({
  outputFormat: 'plain',
  includeTools: false,
});

export const plainWithTools = createPromptBuilderProvider({
  outputFormat: 'plain',
  includeTools: true,
});

// Default export for promptfoo CLI
export default telegramHtml;
