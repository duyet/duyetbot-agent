/**
 * Chat API Route
 *
 * Handles AI chat messages using Cloudflare AI Gateway with AI SDK v6.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { Hono } from 'hono';
import { agentTools } from '../lib/agent-tools';
import { getUser, optionalAuth } from '../lib/auth-middleware';
import { getOrCreateGuestUser } from '../lib/guest-auth';
import { getWebChatPrompt } from '../lib/prompts';
import { checkRateLimit } from '../lib/rate-limit';
import { generateTitleFromMessage } from '../lib/title-generator';

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

interface ChatRequest {
  messages: UIMessage[];
  sessionId?: string;
  model?: string;
  enabledTools?: string[];
  subAgentId?: string;

  // Chat mode parameters
  webSearchEnabled?: boolean;
  deepThinkEnabled?: boolean;

  // Agent mode parameters
  thinkingMode?: 'quick' | 'normal' | 'extended';
  mcpServers?: string[];
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

async function ensureSessionExists(
  db: D1Database,
  sessionId: string,
  userId: string
): Promise<void> {
  const existing = await db.prepare(`SELECT id FROM sessions WHERE id = ?`).bind(sessionId).first();

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(sessionId, userId, 'New chat', Date.now(), Date.now())
      .run();
  }
}

async function saveMessage(
  db: D1Database,
  messageId: string,
  sessionId: string,
  content: string,
  role: 'user' | 'assistant'
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO messages (id, session_id, content, role, created_at) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(messageId, sessionId, content, role, Date.now())
    .run();
}

async function updateSessionTitle(db: D1Database, sessionId: string, title: string): Promise<void> {
  await db
    .prepare(`UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`)
    .bind(title, Date.now(), sessionId)
    .run();
}

chatRouter.post('/', optionalAuth, async (c) => {
  const executionId = generateExecutionId();
  const env = c.env;

  console.log('[Chat API] Request started:', { executionId, timestamp: new Date().toISOString() });

  try {
    const body = (await c.req.json()) as ChatRequest;
    const {
      messages,
      sessionId = crypto.randomUUID(),
      model = 'anthropic/claude-3.5-sonnet',
      enabledTools,
      // Chat mode parameters
      webSearchEnabled = false,
      deepThinkEnabled = false,
      // Agent mode parameters
      thinkingMode = 'normal',
      mcpServers = [],
    } = body;

    // Get userId from auth if available, otherwise create guest user
    let userId = 'anonymous';
    try {
      const user = getUser(c);
      userId = user.id;
    } catch {
      // No auth, create or get guest user
      const guest = await getOrCreateGuestUser(c, env);
      userId = guest.id;
    }

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      console.error('[Chat API] Missing or invalid messages field');
      return c.json(
        {
          error: 'Bad Request',
          message: 'Messages field is required and must be an array',
          executionId,
        },
        400
      );
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(env, userId);
    if (!rateLimit.allowed) {
      console.error('[Chat API] Rate limit exceeded for user:', userId);
      return c.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          executionId,
          remaining: rateLimit.remaining,
        },
        429
      );
    }

    console.log('[Chat API] Request body:', {
      messagesCount: messages.length,
      model,
      sessionId,
      userId,
      enabledTools,
      webSearchEnabled,
      deepThinkEnabled,
      thinkingMode,
      mcpServers,
    });

    if (!env?.AI) {
      console.error('[Chat API] AI Gateway binding not available');
      return c.json(
        { error: 'Service Unavailable', message: 'AI Gateway binding not available', executionId },
        503
      );
    }

    if (!env.AI_GATEWAY_NAME) {
      console.error('[Chat API] AI_GATEWAY_NAME not configured');
      return c.json(
        { error: 'Service Unavailable', message: 'AI Gateway name not configured', executionId },
        503
      );
    }

    if (!env.AI_GATEWAY_API_KEY) {
      console.error('[Chat API] AI_GATEWAY_API_KEY not configured');
      return c.json(
        { error: 'Service Unavailable', message: 'AI Gateway API key not configured', executionId },
        503
      );
    }

    const db = env.DB;

    // Ensure session exists
    await ensureSessionExists(db, sessionId, userId);

    // Save user message and optionally generate title
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (lastUserMessage) {
      const userMessageId = crypto.randomUUID();
      // Extract text content from UIMessage parts
      const content =
        lastUserMessage.parts
          ?.map((p: any) => (p.type === 'text' ? p.text : ''))
          .filter(Boolean)
          .join('\n') || '';
      await saveMessage(db, userMessageId, sessionId, content, 'user');

      // Generate title from first user message asynchronously
      const isFirstMessage = messages.length <= 2;
      if (isFirstMessage) {
        generateTitleFromMessage(env, content)
          .then((title) => updateSessionTitle(db, sessionId, title))
          .catch((err) => console.error('[Chat API] Failed to generate title:', err));
      }
    }

    console.log('[Chat API] Converting messages to model format...');
    const coreMessages = await convertToModelMessages(messages);

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

    const filteredTools =
      enabledTools && enabledTools.length > 0
        ? Object.fromEntries(
            Object.entries(agentTools).filter(([name]) => enabledTools.includes(name))
          )
        : {};

    console.log('[Chat API] Filtered tools:', Object.keys(filteredTools));

    // Generate system prompt with enabled tools and mode-specific instructions
    let systemPrompt = getWebChatPrompt(Object.keys(filteredTools));

    // Add mode-specific context to system prompt
    if (webSearchEnabled) {
      systemPrompt +=
        '\n\n[Web Search Mode Active] You have access to web search capabilities. When answering questions, search for current information when needed.';
    }
    if (deepThinkEnabled) {
      systemPrompt +=
        '\n\n[Deep Think Mode Active] Take extra time to reason through complex problems step by step. Show your thinking process and provide thorough, well-considered responses.';
    }
    if (mcpServers.length > 0) {
      systemPrompt += `\n\n[MCP Servers Connected] The following MCP servers are available: ${mcpServers.join(', ')}. Use these tools when appropriate.`;
    }

    // Configure temperature based on thinking mode
    const temperatureMap = {
      quick: 0.3, // Fast, more deterministic responses
      normal: 0, // Balanced (default)
      extended: 0, // Extended thinking uses lower temp for accuracy
    };
    const temperature = temperatureMap[thinkingMode] ?? 0;

    // Configure step limit based on thinking mode
    const stepLimitMap = {
      quick: 1, // Single step for quick responses
      normal: 2, // Default multi-step
      extended: 5, // More steps for thorough reasoning
    };
    const maxSteps = stepLimitMap[thinkingMode] ?? 2;

    console.log('[Chat API] Starting streamText...', { thinkingMode, temperature, maxSteps });
    const result = streamText({
      model: cloudflareGateway(model),
      system: systemPrompt,
      messages: coreMessages,
      temperature,
      stopWhen: stepCountIs(maxSteps),
      tools: filteredTools,
      onFinish({ usage, finishReason, text }) {
        console.log('[Chat API] Stream finished:', { usage, finishReason, executionId });
        if (db) {
          // Store usage tracking
          storeUsage(
            db,
            executionId,
            sessionId,
            userId,
            model,
            usage?.inputTokens ?? 0,
            usage?.outputTokens ?? 0,
            finishReason ?? 'unknown'
          ).catch((error) => console.error('[Chat API] Failed to store usage:', error));

          // Save assistant message
          if (text) {
            const assistantMessageId = crypto.randomUUID();
            saveMessage(db, assistantMessageId, sessionId, text, 'assistant').catch((error) =>
              console.error('[Chat API] Failed to save assistant message:', error)
            );
          }
        }
      },
    });

    console.log('[Chat API] Returning stream response');
    const response = result.toUIMessageStreamResponse({
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
