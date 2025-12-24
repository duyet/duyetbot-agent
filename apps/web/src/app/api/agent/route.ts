/**
 * Agent API Route
 *
 * Handles multi-step AI agent execution using Cloudflare AI Gateway with AI SDK v6.
 * Uses streamText with extended step limits for complex agent workflows.
 * Compatible with AI SDK v6 useChat hook with UIMessage parts array format.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { stepCountIs, streamText } from 'ai';
import { agentTools } from '../lib/agent-tools';
import { getSubAgentById } from '../lib/sub-agents';

/**
 * Fallback agent system prompt
 */
const AGENT_SYSTEM_PROMPT = `You are a proactive AI agent focused on task execution.
Your role is to:
- Create action plans for complex tasks
- Use tools independently to accomplish goals
- Chain multiple steps toward objectives
- Be succinct in explanations, focus on results
- Use web search, APIs, calculations as needed

Prefer action plans over verbose explanations.`;

/**
 * UIMessage format from AI SDK v6 useChat hook
 */
interface UIMessage {
  role: 'system' | 'user' | 'assistant';
  parts: UIMessagePart[];
}

/**
 * Message part types from AI SDK v6
 */
type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown };

/**
 * Agent request body from AI SDK v6 useChat hook
 */
interface AgentRequest {
  /** Messages in UIMessage format with parts array */
  messages: UIMessage[];
  /** Session ID for conversation tracking */
  sessionId?: string;
  /** Model override (defaults to claude-3.5-sonnet) */
  model?: string;
  /** User ID from auth session */
  userId?: string;
  /** Sub-agent ID for specialized behavior */
  subAgentId?: string;
}

/**
 * Cloudflare AI binding interface
 */
interface CloudflareAIBinding {
  gateway: (gatewayId: string) => {
    getUrl: (provider: string) => Promise<string>;
  };
}

/**
 * Cloudflare environment bindings
 */
interface CloudflareEnv {
  /** Cloudflare AI binding for gateway URL construction */
  AI?: CloudflareAIBinding;
  /** Gateway name configured in Cloudflare dashboard */
  AI_GATEWAY_NAME?: string;
  /** AI Gateway API key for BYOK authentication */
  AI_GATEWAY_API_KEY?: string;
  /** D1 Database for usage tracking */
  DB?: D1Database;
}

function generateExecutionId(): string {
  return `exec_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

async function storeUsage(
  db: D1Database,
  executionId: string,
  sessionId: string,
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  finishReason: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO executions (id, session_id, user_id, model, input_tokens, output_tokens, total_tokens, finish_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      executionId,
      sessionId,
      userId,
      model,
      inputTokens,
      outputTokens,
      inputTokens + outputTokens,
      finishReason,
      Date.now()
    )
    .run();
}

function getCloudflareEnv(): CloudflareEnv | null {
  return (globalThis as any)[Symbol.for('__cloudflare-context__')]?.env;
}

/**
 * Convert UIMessage format to CoreMessage format
 * Extracts text from parts array
 */
function convertUIMessageToCoreMessages(
  messages: UIMessage[]
): Array<{ role: 'system'; content: string } | { role: 'user' | 'assistant'; content: string }> {
  const result: Array<
    { role: 'system'; content: string } | { role: 'user' | 'assistant'; content: string }
  > = [];

  for (const msg of messages) {
    const textContent = msg.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('');

    if (textContent) {
      result.push({
        role: msg.role,
        content: textContent,
      });
    }
  }

  return result;
}

export async function POST(request: Request) {
  const executionId = generateExecutionId();

  try {
    const body = (await request.json()) as AgentRequest;
    const {
      messages,
      sessionId = crypto.randomUUID(),
      model = 'anthropic/claude-3.5-sonnet',
      userId = 'anonymous',
      subAgentId,
    } = body;

    const env = getCloudflareEnv();

    // Check for required environment bindings
    if (!env?.AI) {
      return new Response(
        JSON.stringify({
          error: 'Service Unavailable',
          message: 'AI Gateway binding not available',
          executionId,
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'X-Execution-ID': executionId,
          },
        }
      );
    }

    if (!env.AI_GATEWAY_NAME) {
      return new Response(
        JSON.stringify({
          error: 'Service Unavailable',
          message: 'AI Gateway name not configured',
          executionId,
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'X-Execution-ID': executionId,
          },
        }
      );
    }

    if (!env.AI_GATEWAY_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'Service Unavailable',
          message: 'AI Gateway API key not configured',
          executionId,
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'X-Execution-ID': executionId,
          },
        }
      );
    }

    const db = env.DB;

    // Convert UIMessage to CoreMessage format
    let coreMessages = convertUIMessageToCoreMessages(messages);

    // Validate that we have at least one message
    if (coreMessages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'No messages provided',
          executionId,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'X-Execution-ID': executionId,
          },
        }
      );
    }

    // Determine system prompt and tools based on sub-agent
    const subAgent = subAgentId ? getSubAgentById(subAgentId) : undefined;
    const systemPrompt = subAgent?.systemPrompt ?? AGENT_SYSTEM_PROMPT;

    // Filter tools based on sub-agent configuration
    const filteredTools = subAgent
      ? Object.fromEntries(
          Object.entries(agentTools).filter(([key]) => subAgent.tools.includes(key))
        )
      : agentTools;

    // Prepend system prompt as first message
    coreMessages = [{ role: 'system' as const, content: systemPrompt }, ...coreMessages];

    // Create custom provider for Cloudflare Gateway
    const gatewayUrl = await env.AI.gateway(env.AI_GATEWAY_NAME).getUrl('openrouter');

    const cloudflareGateway = createOpenAICompatible({
      name: 'cloudflare-gateway',
      baseURL: gatewayUrl,
      headers: {
        'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_API_KEY}`,
      },
      includeUsage: true,
    });

    // Use streamText with the custom provider
    const result = streamText({
      model: cloudflareGateway(model),
      messages: coreMessages,
      temperature: 0,
      stopWhen: stepCountIs(10), // Allow up to 10 steps for complex agent workflows
      tools: filteredTools,
      onFinish({ usage, finishReason }) {
        if (db) {
          storeUsage(
            db,
            executionId,
            sessionId,
            userId,
            model,
            usage?.inputTokens ?? 0,
            usage?.outputTokens ?? 0,
            finishReason ?? 'unknown'
          ).catch((error) => {
            console.error('[Agent API] Failed to store usage:', error);
          });
        }
      },
    });

    return result.toUIMessageStreamResponse({
      headers: {
        'X-Execution-ID': executionId,
        'X-Session-ID': sessionId,
      },
    });
  } catch (error) {
    console.error('[Agent API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Return error as JSON for proper error display in UI
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: errorMessage,
        executionId,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Execution-ID': executionId,
        },
      }
    );
  }
}

export const maxDuration = 300;
