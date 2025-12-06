/**
 * GitHub Agent Provider
 *
 * Implements AgentProvider interface combining:
 * - OpenRouter LLM provider via Cloudflare AI Gateway
 * - GitHub transport layer (send/edit comments via Octokit)
 *
 * Supports native web search for xAI models.
 */

import type {
  AgentProvider,
  ChatOptions,
  LLMProvider,
  LLMResponse,
  Message,
  MessageRef,
  ParsedInput,
  ProviderExecutionContext,
} from '@duyetbot/cloudflare-agent';
import {
  createOpenRouterProvider,
  type OpenRouterProviderEnv,
  type OpenRouterProviderOptions,
} from '@duyetbot/providers';
import { logger } from './logger.js';
import type { GitHubContext } from './transport.js';
import { githubTransport } from './transport.js';

/**
 * Environment for GitHub bot provider
 *
 * Combines OpenRouter provider config with GitHub platform requirements
 */
export interface GitHubEnv extends OpenRouterProviderEnv {
  // GitHub API
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET?: string;
  BOT_USERNAME?: string;
  GITHUB_ADMIN?: string;

  // Common config
  ENVIRONMENT?: string;
  ROUTER_DEBUG?: string;
}

/**
 * Create an LLM-only provider for GitHub bot (legacy)
 *
 * @example
 * ```typescript
 * const provider = createProvider(env);
 * const response = await provider.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export function createProvider(
  env: OpenRouterProviderEnv,
  options?: Partial<OpenRouterProviderOptions>
): LLMProvider {
  logger.info('GitHub bot creating LLM provider', {
    gateway: env.AI_GATEWAY_NAME,
    model: env.MODEL || 'x-ai/grok-4.1-fast',
  });

  return createOpenRouterProvider(env, {
    maxTokens: 2048,
    requestTimeout: 60000,
    enableWebSearch: true, // Enable native web search for xAI models
    logger,
    ...options,
  });
}

/**
 * Create a GitHub Agent Provider implementing AgentProvider interface
 *
 * Combines LLM chat capabilities with GitHub transport operations.
 * Handles message sending, editing, and context creation.
 *
 * @param env - GitHub environment bindings
 * @param options - Optional provider configuration
 * @returns AgentProvider ready for use with CloudflareChatAgent
 *
 * @example
 * ```typescript
 * const provider = createGitHubProvider(env);
 * const ctx = provider.createContext(parsedInput);
 * const response = await provider.chat(messages);
 * const ref = await provider.send(ctx, response.content);
 * await provider.edit(ctx, ref, 'Updated response...');
 * ```
 */
export function createGitHubProvider(
  env: GitHubEnv,
  options?: Partial<OpenRouterProviderOptions>
): AgentProvider {
  logger.info('Creating GitHub agent provider', {
    gateway: env.AI_GATEWAY_NAME,
    model: env.MODEL || 'x-ai/grok-4.1-fast',
  });

  const llmProvider = createOpenRouterProvider(env, {
    maxTokens: 2048,
    requestTimeout: 60000,
    enableWebSearch: true,
    logger,
    ...options,
  });

  /**
   * GitHub Agent Provider implementation
   */
  const provider: AgentProvider = {
    /**
     * Send a message to the LLM and get a response
     *
     * Routes through OpenRouter via Cloudflare AI Gateway with web search support.
     */
    async chat(messages: Message[], chatOptions?: ChatOptions): Promise<LLMResponse> {
      logger.debug('GitHub provider chat request', {
        messageCount: messages.length,
        model: chatOptions?.model,
      });

      try {
        const response = await llmProvider.chat(messages, undefined, chatOptions);
        logger.debug('GitHub provider chat response', {
          hasContent: !!response.content,
          toolCallCount: response.toolCalls?.length || 0,
        });
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('GitHub provider chat error', { error: errorMessage });
        throw error;
      }
    },

    /**
     * Send a message to GitHub issue/PR as a comment
     *
     * Uses Octokit to create a new comment. GitHub context must be stored
     * in ProviderExecutionContext.metadata.
     */
    async send(ctx: ProviderExecutionContext, content: string): Promise<MessageRef> {
      logger.debug('GitHub provider sending message', {
        chatId: ctx.chatId,
        contentLength: content.length,
      });

      // Reconstruct GitHub context from metadata
      const githubCtx = reconstructGitHubContext(ctx, env);

      try {
        const ref = await githubTransport.send(githubCtx, content);
        logger.debug('GitHub provider message sent', { messageRef: ref });
        return ref;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('GitHub provider send error', { error: errorMessage });
        throw error;
      }
    },

    /**
     * Edit a previously sent GitHub comment
     *
     * Updates the comment body via Octokit. Requires comment ID in messageRef.
     */
    async edit(ctx: ProviderExecutionContext, ref: MessageRef, content: string): Promise<void> {
      logger.debug('GitHub provider editing message', {
        chatId: ctx.chatId,
        messageRef: ref,
        contentLength: content.length,
      });

      // Reconstruct GitHub context from metadata
      const githubCtx = reconstructGitHubContext(ctx, env);

      try {
        if (!githubTransport.edit) {
          logger.warn('GitHub transport does not support edit operations');
          return;
        }
        await githubTransport.edit(githubCtx, ref, content);
        logger.debug('GitHub provider message edited', { messageRef: ref });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('GitHub provider edit error', { error: errorMessage });
        throw error;
      }
    },

    /**
     * Send typing indicator (no-op for GitHub)
     *
     * GitHub doesn't have a typing indicator API, so this is a no-op.
     * Kept for interface compliance.
     */
    async typing(_ctx: ProviderExecutionContext): Promise<void> {
      // GitHub has no typing indicator API
      logger.debug('GitHub provider typing (no-op)');
    },

    /**
     * Create a ProviderExecutionContext from ParsedInput
     *
     * Converts the parsed GitHub context into a ProviderExecutionContext
     * with proper metadata for transport operations.
     */
    createContext(input: ParsedInput): ProviderExecutionContext {
      logger.debug('Creating GitHub provider context', {
        chatId: input.chatId,
        userId: input.userId,
      });

      return {
        text: input.text,
        userId: input.userId,
        chatId: input.chatId,
        username: input.username,
        messageRef: input.messageRef,
        replyTo: input.replyTo,
        metadata: input.metadata,
        createdAt: Date.now(),
      };
    },
  };

  return provider;
}

/**
 * Reconstruct GitHubContext from ProviderExecutionContext metadata
 *
 * The transport layer expects GitHubContext, but the provider receives
 * ProviderExecutionContext. We reconstruct from metadata which was
 * populated by githubTransport.parseContext().
 *
 * @param ctx - ProviderExecutionContext with GitHub metadata
 * @param env - Environment for GitHub token
 * @returns Reconstructed GitHubContext
 */
function reconstructGitHubContext(ctx: ProviderExecutionContext, env: GitHubEnv): GitHubContext {
  const metadata = ctx.metadata as Record<string, unknown> & {
    owner?: string;
    repo?: string;
    issueNumber?: number;
    senderLogin?: string;
  };

  return {
    githubToken: env.GITHUB_TOKEN,
    owner: metadata.owner as string,
    repo: metadata.repo as string,
    issueNumber: metadata.issueNumber as number,
    body: ctx.text,
    sender: {
      id: typeof ctx.userId === 'number' ? ctx.userId : parseInt(String(ctx.userId), 10),
      login: metadata.senderLogin as string,
    },
    startTime: ctx.createdAt || Date.now(),
    url: metadata.url as string,
    title: metadata.title as string,
    isPullRequest: metadata.isPullRequest as boolean,
    state: metadata.state as string,
    labels: (metadata.labels as string[]) || [],
  };
}

// Re-export for backwards compatibility
export type ProviderEnv = OpenRouterProviderEnv;
export { createProvider as createOpenRouterProvider };
