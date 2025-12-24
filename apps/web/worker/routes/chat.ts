/**
 * Chat API Route
 *
 * Handles AI chat messages using Cloudflare AI Gateway with AI SDK v6.
 */

import { Hono } from 'hono';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { stepCountIs, streamText } from 'ai';
import { agentTools } from '../lib/agent-tools';

type Bindings = {
  AI: any;
  DB: D1Database;
  AI_GATEWAY_NAME: string;
  AI_GATEWAY_API_KEY: string;
};

const chatRouter = new Hono<{ Bindings: Bindings }>();

// Handle OPTIONS for CORS preflight
chatRouter.options('/', (c) => {
  return c.text('', 200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Execution-ID, X-Session-ID',
    'Access-Control-Expose-Headers': 'X-Execution-ID, X-Session-ID',
    'Access-Control-Max-Age': '86400',
  });
});

const CHAT_SYSTEM_PROMPT = `You are a helpful AI assistant focused on dialogue and explanation.
Your role is to:
- Answer questions with detailed, clear explanations
- Provide "how" and "why" breakdowns
- Be reactive - wait for user input
- Avoid taking actions or making changes
- Minimize tool usage - only use when absolutely necessary

Prefer thorough explanations over quick actions.`;

interface UIMessage {
  role: 'system' | 'user' | 'assistant';
  parts: UIMessagePart[];
}

type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown };

interface ChatRequest {
  messages: UIMessage[];
  sessionId?: string;
  model?: string;
  userId?: string;
  enabledTools?: string[];
  subAgentId?: string;
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
    .bind(executionId, sessionId, userId, model, inputTokens, outputTokens, inputTokens + outputTokens, finishReason, Date.now())
    .run();
}

function convertUIMessageToCoreMessages(messages: UIMessage[]): Array<{ role: 'system'; content: string } | { role: 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'system'; content: string } | { role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of messages) {
    const textContent = msg.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('');

    if (textContent) {
      result.push({ role: msg.role, content: textContent });
    }
  }

  return result;
}

chatRouter.post('/', async (c) => {
  const executionId = generateExecutionId();
  const env = c.env;

  console.log('[Chat API] Request started:', { executionId, timestamp: new Date().toISOString() });

  try {
    const body = await c.req.json() as ChatRequest;
    const {
      messages,
      sessionId = crypto.randomUUID(),
      model = 'anthropic/claude-3.5-sonnet',
      userId = 'anonymous',
      enabledTools,
    } = body;

    console.log('[Chat API] Request body:', { messagesCount: messages.length, model, sessionId, userId, enabledTools });

    if (!env?.AI) {
      console.error('[Chat API] AI Gateway binding not available');
      return c.json({ error: 'Service Unavailable', message: 'AI Gateway binding not available', executionId }, 503);
    }

    if (!env.AI_GATEWAY_NAME) {
      console.error('[Chat API] AI_GATEWAY_NAME not configured');
      return c.json({ error: 'Service Unavailable', message: 'AI Gateway name not configured', executionId }, 503);
    }

    if (!env.AI_GATEWAY_API_KEY) {
      console.error('[Chat API] AI_GATEWAY_API_KEY not configured');
      return c.json({ error: 'Service Unavailable', message: 'AI Gateway API key not configured', executionId }, 503);
    }

    const db = env.DB;
    const coreMessages = convertUIMessageToCoreMessages(messages);

    if (coreMessages.length === 0) {
      console.error('[Chat API] No messages provided after conversion');
      return c.json({ error: 'Bad Request', message: 'No messages provided', executionId }, 400);
    }

    console.log('[Chat API] Core messages:', coreMessages);
    console.log('[Chat API] Getting gateway URL for:', env.AI_GATEWAY_NAME);

    const gatewayUrl = await env.AI.gateway(env.AI_GATEWAY_NAME).getUrl('openrouter');
    console.log('[Chat API] Gateway URL:', gatewayUrl);

    const cloudflareGateway = createOpenAICompatible({
      name: 'cloudflare-gateway',
      baseURL: gatewayUrl,
      headers: { 'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_API_KEY}` },
      includeUsage: true,
    });

    const filteredTools = enabledTools && enabledTools.length > 0
      ? Object.fromEntries(Object.entries(agentTools).filter(([name]) => enabledTools.includes(name)))
      : {};

    console.log('[Chat API] Filtered tools:', Object.keys(filteredTools));

    console.log('[Chat API] Starting streamText...');
    const result = streamText({
      model: cloudflareGateway(model),
      system: CHAT_SYSTEM_PROMPT,
      messages: coreMessages,
      temperature: 0,
      stopWhen: stepCountIs(2),
      tools: filteredTools,
      onFinish({ usage, finishReason }) {
        console.log('[Chat API] Stream finished:', { usage, finishReason, executionId });
        if (db) {
          storeUsage(db, executionId, sessionId, userId, model, usage?.inputTokens ?? 0, usage?.outputTokens ?? 0, finishReason ?? 'unknown')
            .catch((error) => console.error('[Chat API] Failed to store usage:', error));
        }
      },
    });

    console.log('[Chat API] Returning stream response');
    const response = result.toTextStreamResponse({
      headers: {
        'X-Execution-ID': executionId,
        'X-Session-ID': sessionId,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Execution-ID, X-Session-ID',
        'Access-Control-Expose-Headers': 'X-Execution-ID, X-Session-ID',
      },
    });

    return response;
  } catch (error) {
    console.error('[Chat API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal Server Error', message: errorMessage, executionId }, 500);
  }
});

export { chatRouter };
