/**
 * LLM Provider for GitHub Bot
 *
 * Uses Cloudflare AI Gateway for LLM calls
 */

import type { LLMMessage, LLMProvider, LLMResponse, OpenAITool } from '@duyetbot/chat-agent';
import { logger } from './logger.js';

export interface ProviderEnv {
  // Cloudflare AI Gateway
  AI: any;
  AI_GATEWAY_NAME: string;
  AI_GATEWAY_PROVIDER?: string | undefined;
  AI_GATEWAY_API_KEY?: string | undefined;
  MODEL?: string | undefined;
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

/**
 * Create an LLM provider using Cloudflare AI Gateway
 */
export function createOpenRouterProvider(env: ProviderEnv): LLMProvider {
  return {
    async chat(messages: LLMMessage[], tools?: OpenAITool[]): Promise<LLMResponse> {
      const gateway = env.AI.gateway(env.AI_GATEWAY_NAME);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (env.AI_GATEWAY_API_KEY) {
        headers['cf-aig-authorization'] = `Bearer ${env.AI_GATEWAY_API_KEY}`;
      }

      const model = env.MODEL || 'x-ai/grok-4.1-fast';

      const query: Record<string, unknown> = {
        model,
        max_tokens: 2048,
        messages,
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        query.tools = tools;
        query.tool_choice = 'auto';
      }

      const startTime = Date.now();

      logger.debug('LLM request started', {
        model,
        messageCount: messages.length,
        hasTools: !!tools && tools.length > 0,
        toolCount: tools?.length || 0,
        gateway: env.AI_GATEWAY_NAME,
      });

      let response: Response;
      try {
        logger.debug('Gateway run started', {
          provider: env.AI_GATEWAY_PROVIDER || 'openrouter',
          endpoint: 'chat/completions',
          model,
          gateway: env.AI_GATEWAY_NAME,
        });

        response = await gateway.run({
          provider: env.AI_GATEWAY_PROVIDER || 'openrouter',
          endpoint: 'chat/completions',
          headers,
          query,
        });

        logger.debug('Gateway run completed', {
          status: response.status,
          ok: response.ok,
          durationMs: Date.now() - startTime,
        });
      } catch (gatewayError) {
        const errorMessage =
          gatewayError instanceof Error ? gatewayError.message : String(gatewayError);
        logger.error('Gateway run error', {
          model,
          gateway: env.AI_GATEWAY_NAME,
          provider: env.AI_GATEWAY_PROVIDER || 'openrouter',
          error: errorMessage,
          durationMs: Date.now() - startTime,
          stack: gatewayError instanceof Error ? gatewayError.stack : undefined,
        });
        throw new Error(`AI Gateway run failed: ${errorMessage}`);
      }

      if (!response.ok) {
        const error = await response.text();
        logger.error('LLM request error', {
          model,
          status: response.status,
          statusText: response.statusText,
          error,
          durationMs: Date.now() - startTime,
        });
        throw new Error(`AI Gateway error: ${response.status} - ${error}`);
      }

      let data: OpenAIResponse;
      try {
        data = (await response.json()) as OpenAIResponse;
        logger.debug('LLM response parsed', {
          hasChoices: !!data.choices,
          choiceCount: data.choices?.length || 0,
        });
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        logger.error('LLM response parse error', {
          model,
          error: errorMsg,
          durationMs: Date.now() - startTime,
        });
        throw new Error(`Failed to parse AI Gateway response: ${errorMsg}`);
      }

      const choice = data.choices?.[0]?.message;

      // Extract tool calls if present
      const toolCalls = choice?.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      const durationMs = Date.now() - startTime;

      logger.info('LLM request completed', {
        model,
        durationMs,
        hasContent: !!choice?.content,
        contentLength: choice?.content?.length || 0,
        toolCallCount: toolCalls?.length || 0,
      });

      if (toolCalls && toolCalls.length > 0) {
        logger.debug('LLM tool calls', {
          model,
          tools: toolCalls.map((tc) => tc.name),
        });
      }

      return {
        content: choice?.content || '',
        ...(toolCalls && toolCalls.length > 0 && { toolCalls }),
      };
    },
  };
}
