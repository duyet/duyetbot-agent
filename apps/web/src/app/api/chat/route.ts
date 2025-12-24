import { getPlatformTools } from '@duyetbot/tools';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { convertToCoreMessages, streamText } from 'ai';

const MAX_TOOL_ITERATIONS = 10;

interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  sessionId?: string;
  model?: string;
}

function generateExecutionId(): string {
  return `exec_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

interface MCPToolCallResult {
  content: Array<{ type: string; text?: string }>;
}

async function executeMCPTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const serverUrls: Record<string, string> = {
    'duyet-mcp': process.env.MCP_DUYET_URL || 'https://duyetbot-memory.duyet.workers.dev',
    'github-mcp': process.env.MCP_GITHUB_URL || 'https://duyetbot-github.duyet.workers.dev',
  };

  const baseUrl = serverUrls[serverName];
  if (!baseUrl) {
    throw new Error(`Unknown MCP server: ${serverName}`);
  }

  const response = await fetch(`${baseUrl}/api/tools/${toolName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.MCP_DUYET_TOKEN && {
        Authorization: `Bearer ${process.env.MCP_DUYET_TOKEN}`,
      }),
      ...(process.env.MCP_GITHUB_TOKEN && {
        Authorization: `Bearer ${process.env.MCP_GITHUB_TOKEN}`,
      }),
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MCP tool execution failed: ${error}`);
  }

  const result = (await response.json()) as MCPToolCallResult;
  return result.content.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
}

async function buildTools() {
  const builtinTools = getPlatformTools('telegram');

  const tools: Record<
    string,
    { description: string; parameters: any; execute: (args: any) => Promise<any> }
  > = {};

  for (const tool of builtinTools) {
    tools[tool.name] = {
      description: tool.description,
      parameters: tool.inputSchema,
      execute: async (args: any) => {
        const result = await tool.execute({ content: args });
        if (result.status === 'error' && result.error) {
          throw result.error;
        }
        return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      },
    };
  }

  const mcpToolDefinitions: Record<
    string,
    { server: string; description: string; parameters: any }
  > = {
    'duyet-mcp__get_memory': {
      server: 'duyet-mcp',
      description: 'Get memory for a session',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          limit: { type: 'number' },
          offset: { type: 'number' },
        },
      },
    },
    'duyet-mcp__save_memory': {
      server: 'duyet-mcp',
      description: 'Save memory for a session',
      parameters: {
        type: 'object',
        properties: {
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                content: { type: 'string' },
              },
            },
          },
          session_id: { type: 'string' },
        },
      },
    },
    'duyet-mcp__search_memory': {
      server: 'duyet-mcp',
      description: 'Search memory across sessions',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
    'duyet-mcp__list_sessions': {
      server: 'duyet-mcp',
      description: 'List sessions',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          offset: { type: 'number' },
        },
      },
    },
  };

  for (const [toolName, definition] of Object.entries(mcpToolDefinitions)) {
    const [serverName, ...toolNameParts] = toolName.split('__');
    const actualToolName = toolNameParts.join('__');

    tools[toolName] = {
      description: definition.description,
      parameters: definition.parameters,
      execute: async (args: any) => {
        return await executeMCPTool(serverName, actualToolName, args);
      },
    };
  }

  return tools;
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

function getCloudflareEnv() {
  return (globalThis as any)[Symbol.for('__cloudflare-context__')]?.env;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;
  const { messages, sessionId = crypto.randomUUID(), model = 'anthropic/claude-3.5-sonnet' } = body;

  const userId = 'user_id_from_session'; // TODO: Get from actual session

  const executionId = generateExecutionId();

  try {
    const env = getCloudflareEnv();
    if (!env?.DB) {
      throw new Error('Cloudflare bindings not available');
    }
    const db = env.DB as D1Database;

    const tools = await buildTools();

    const result = await streamText({
      model: openrouter(model) as any,
      messages: convertToCoreMessages(messages),
      tools,
      temperature: 0,
      toolChoice: 'auto',
      experimental_toolCallStreaming: true,
      maxSteps: MAX_TOOL_ITERATIONS,
      async onFinish({ usage, finishReason }) {
        try {
          await storeUsage(
            db,
            executionId,
            sessionId,
            userId,
            model,
            usage.promptTokens,
            usage.completionTokens,
            finishReason
          );
        } catch (error) {
          console.error('[Chat API] Failed to store usage:', error);
        }
      },
    });

    return result.toDataStreamResponse({
      headers: {
        'X-Execution-ID': executionId,
        'X-Session-ID': sessionId,
      },
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
