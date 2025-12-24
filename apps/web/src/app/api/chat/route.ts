/**
 * Chat API Route
 *
 * Handles AI chat messages using Cloudflare AI Gateway.
 * Compatible with AI SDK v6 useChat hook with UIMessage parts array format.
 */

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
 * Chat request body from AI SDK v6 useChat hook
 */
interface ChatRequest {
  /** Messages in UIMessage format with parts array */
  messages: UIMessage[];
  /** Session ID for conversation tracking */
  sessionId?: string;
  /** Model override (defaults to claude-3.5-sonnet) */
  model?: string;
  /** User ID from auth session */
  userId?: string;
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

/**
 * OpenAI-compatible chat message format
 */
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * OpenAI chat completion request format
 */
interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  stream: true;
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
 * Convert UIMessage format to OpenAI-compatible message format
 * Extracts text from parts array
 */
function convertToOpenAIMessages(messages: UIMessage[]): OpenAIMessage[] {
  return messages
    .map((msg) => {
      const textContent = msg.parts
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('');

      if (!textContent) {
        return null;
      }

      return {
        role: msg.role,
        content: textContent,
      };
    })
    .filter((msg): msg is OpenAIMessage => msg !== null);
}

/**
 * Create a streaming response compatible with AI SDK v6
 */
function createStreamResponse(
  stream: ReadableStream,
  headers: HeadersInit
): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...headers,
    },
  });
}

export async function POST(request: Request) {
  const executionId = generateExecutionId();

  try {
    const body = (await request.json()) as ChatRequest;
    const {
      messages,
      sessionId = crypto.randomUUID(),
      model = 'anthropic/claude-3.5-sonnet',
      userId = 'anonymous',
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

    // Convert UIMessage format to OpenAI format
    const openAIMessages = convertToOpenAIMessages(messages);

    // Validate that we have at least one message
    if (openAIMessages.length === 0) {
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

    // Get AI Gateway URL
    const gatewayUrl = await env.AI.gateway(env.AI_GATEWAY_NAME).getUrl('openrouter');
    const url = `${gatewayUrl}/chat/completions`;

    // Prepare request body
    const chatBody: OpenAIChatRequest = {
      model,
      messages: openAIMessages,
      max_tokens: 4096,
      stream: true,
    };

    // Make request to AI Gateway
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_API_KEY}`,
      },
      body: JSON.stringify(chatBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Chat API] AI Gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({
          error: 'Bad Gateway',
          message: `AI Gateway returned ${response.status}: ${errorText}`,
          executionId,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'X-Execution-ID': executionId,
          },
        }
      );
    }

    if (!response.body) {
      return new Response(
        JSON.stringify({
          error: 'Bad Gateway',
          message: 'AI Gateway returned empty response body',
          executionId,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'X-Execution-ID': executionId,
          },
        }
      );
    }

    // Track usage in background
    if (db) {
      (async () => {
        try {
          // Note: We can't track exact tokens from streaming without parsing
          // This is a placeholder - actual tracking would require parsing the stream
          await storeUsage(db, executionId, sessionId, userId, model, 0, 0, 'streaming');
        } catch (error) {
          console.error('[Chat API] Failed to store usage:', error);
        }
      })();
    }

    // Create a transform stream to convert SSE format to AI SDK v6 format
    const transformStream = new TransformStream({
      transform(chunk: Uint8Array, controller) {
        const text = new TextDecoder().decode(chunk);
        controller.enqueue(new TextEncoder().encode(text));
      },
    });

    const transformedStream = response.body.pipeThrough(transformStream);

    return createStreamResponse(transformedStream, {
      'X-Execution-ID': executionId,
      'X-Session-ID': sessionId,
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
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

export const maxDuration = 60;
