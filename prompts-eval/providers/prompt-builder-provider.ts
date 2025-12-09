/**
 * PromptBuilder Provider for Promptfoo
 *
 * Wraps the existing PromptBuilder to generate prompts for evaluation.
 * Promptfoo will call these providers to get the system prompt.
 *
 * @example
 * ```yaml
 * providers:
 *   - id: file://providers/prompt-builder-provider.ts
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

interface ProviderOptions {
  config?: PromptBuilderConfig;
}

interface CallApiContext {
  vars?: Record<string, unknown>;
}

interface ProviderResponse {
  output: string;
  tokenUsage?: { total: number; prompt: number; completion: number };
}

/**
 * PromptBuilder provider class for promptfoo
 */
export default class PromptBuilderProvider {
  private config: PromptBuilderConfig;

  constructor(options?: ProviderOptions) {
    this.config = options?.config ?? {
      platform: 'telegram',
      outputFormat: 'telegram-html',
      includeTools: false,
    };
  }

  id(): string {
    const parts = ['prompt-builder'];
    if (this.config.platform) parts.push(this.config.platform);
    if (this.config.outputFormat) parts.push(this.config.outputFormat);
    return parts.join('-');
  }

  async callApi(prompt: string, _context?: CallApiContext): Promise<ProviderResponse> {
    const builder = createPrompt({ botName: '@duyetbot' })
      .withIdentity()
      .withPolicy()
      .withCapabilities(this.config.capabilities);

    // Platform-specific setup
    if (this.config.platform) {
      builder.forPlatform(this.config.platform);
    }

    // Apply output format if specified
    if (this.config.outputFormat) {
      builder.withOutputFormat(this.config.outputFormat);
    }

    // Add tools if requested
    if (this.config.includeTools) {
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

    // Build the system prompt
    const systemPrompt = builder.build();

    // For prompt testing, we want to simulate a response
    // The actual response would come from an LLM, but for testing
    // we return a formatted mock response based on the query
    const mockResponse = this.generateMockResponse(prompt, this.config);

    return {
      output: mockResponse,
      tokenUsage: { total: 0, prompt: systemPrompt.length, completion: mockResponse.length },
    };
  }

  /**
   * Generate a mock response for testing format compliance
   * This simulates what an LLM would produce given the system prompt
   */
  private generateMockResponse(query: string, config: PromptBuilderConfig): string {
    const format = config.outputFormat;

    if (format === 'telegram-html') {
      return `<b>Response to:</b> ${query}\n\n` +
        `<code>Example code block</code>\n\n` +
        `<i>This is a mock response for testing.</i>`;
    }

    if (format === 'telegram-markdown') {
      return `*Response to:* ${query}\n\n` +
        `\`Example code block\`\n\n` +
        `_This is a mock response for testing\\._`;
    }

    if (format === 'github-markdown') {
      return `## Response\n\n` +
        `> [!NOTE]\n` +
        `> This is a mock response for testing.\n\n` +
        `### Query\n${query}\n\n` +
        `\`\`\`typescript\n// Example code\nconst x = 1;\n\`\`\``;
    }

    return `Response to: ${query}\n\nThis is a mock response for testing.`;
  }
}
