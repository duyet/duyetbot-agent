/**
 * LLM Provider for Cloudflare AI Gateway
 */

import type { LLMMessage, LLMProvider, LLMResponse, OpenAITool } from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';

export interface ProviderEnv {
  AI: Ai;
  AI_GATEWAY_NAME: string;
  AI_GATEWAY_PROVIDER?: string;
  AI_GATEWAY_API_KEY?: string;
  MODEL?: string;
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
 * Create an LLM provider that uses Cloudflare AI Gateway
 */
export function createAIGatewayProvider(env: ProviderEnv): LLMProvider {
  return {
    async chat(messages: LLMMessage[], tools?: OpenAITool[]): Promise<LLMResponse> {
      const gateway = env.AI.gateway(env.AI_GATEWAY_NAME);
      const model = env.MODEL || 'x-ai/grok-4.1-fast';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'cf-aig-request-timeout': '25000', // 25s timeout to prevent DO blockConcurrencyWhile timeout
      };
      if (env.AI_GATEWAY_API_KEY) {
        headers['cf-aig-authorization'] = `Bearer ${env.AI_GATEWAY_API_KEY}`;
      }

      const query: Record<string, unknown> = {
        model,
        max_tokens: 512,
        messages,
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        query.tools = tools;
        query.tool_choice = 'auto';
      }

      logger.info('LLM request started', {
        model,
        messageCount: messages.length,
        hasTools: tools && tools.length > 0,
        toolCount: tools?.length || 0,
      });

      const startTime = Date.now();

      const response = await gateway.run({
        provider: env.AI_GATEWAY_PROVIDER || 'openrouter',
        endpoint: 'chat/completions',
        headers,
        query,
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('AI Gateway error', {
          status: response.status,
          error,
          model,
        });
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const durationMs = Date.now() - startTime;
      logger.info('LLM request completed', { model, durationMs });

      const data = (await response.json()) as OpenAIResponse;
      const choice = data.choices?.[0]?.message;

      // Extract tool calls if present
      const toolCalls = choice?.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      return {
        content: choice?.content || '',
        toolCalls,
      };
    },
  };
}
