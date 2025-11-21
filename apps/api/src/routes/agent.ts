/**
 * Agent Routes
 *
 * Handles chat and agent execution
 */

import { createDefaultOptions, query, toSDKTools } from '@duyetbot/core';
import { getAllBuiltinTools } from '@duyetbot/tools';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AgentResponse, AuthUser } from '../types.js';

type Variables = {
  user?: AuthUser;
  requestId?: string;
  startTime?: number;
};

const agent = new Hono<{ Variables: Variables }>();

// Convert tools once at startup
const builtinSDKTools = toSDKTools(getAllBuiltinTools());

// Request validation schema
const executeSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  model: z.enum(['sonnet', 'haiku', 'opus']).optional(),
});

/**
 * Execute agent (non-streaming)
 */
agent.post('/execute', async (c) => {
  const body = await c.req.json();
  const parseResult = executeSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Invalid request', details: parseResult.error.errors }, 400);
  }

  const { message, sessionId, model } = parseResult.data;
  const user = c.get('user');

  // Generate session ID if not provided
  const actualSessionId = sessionId || `api:${user?.id || 'anon'}:${Date.now()}`;

  const queryOptions = createDefaultOptions({
    model: model || 'sonnet',
    sessionId: actualSessionId,
    tools: builtinSDKTools,
    systemPrompt: `You are duyetbot, a helpful AI assistant. Current user: ${user?.username || 'anonymous'}`,
  });

  let response = '';
  const toolCalls: AgentResponse['toolCalls'] = [];

  try {
    for await (const msg of query(message, queryOptions)) {
      switch (msg.type) {
        case 'assistant':
          if (msg.content) {
            response = msg.content;
          }
          break;
        case 'tool_use':
          toolCalls.push({
            name: 'toolName' in msg ? (msg.toolName as string) : 'unknown',
            input: 'toolInput' in msg ? msg.toolInput : undefined,
            output: undefined,
          });
          break;
        case 'tool_result':
          if (toolCalls.length > 0) {
            toolCalls[toolCalls.length - 1].output = msg.content;
          }
          break;
        case 'result':
          if (msg.content) {
            response = msg.content;
          }
          break;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Agent execution failed', details: errorMessage }, 500);
  }

  const result: AgentResponse = {
    sessionId: actualSessionId,
    message: response,
  };

  if (toolCalls.length > 0) {
    result.toolCalls = toolCalls;
  }

  return c.json(result);
});

/**
 * Execute agent with SSE streaming
 */
agent.post('/stream', async (c) => {
  const body = await c.req.json();
  const parseResult = executeSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Invalid request', details: parseResult.error.errors }, 400);
  }

  const { message, sessionId, model } = parseResult.data;
  const user = c.get('user');

  const actualSessionId = sessionId || `api:${user?.id || 'anon'}:${Date.now()}`;

  const queryOptions = createDefaultOptions({
    model: model || 'sonnet',
    sessionId: actualSessionId,
    tools: builtinSDKTools,
    systemPrompt: `You are duyetbot, a helpful AI assistant. Current user: ${user?.username || 'anonymous'}`,
  });

  return streamSSE(c, async (stream) => {
    try {
      for await (const msg of query(message, queryOptions)) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: msg.type,
            content: 'content' in msg ? msg.content : undefined,
            name: 'name' in msg ? msg.name : undefined,
            input: 'input' in msg ? msg.input : undefined,
          }),
          event: msg.type,
        });
      }

      await stream.writeSSE({
        data: JSON.stringify({ sessionId: actualSessionId }),
        event: 'done',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await stream.writeSSE({
        data: JSON.stringify({ error: errorMessage }),
        event: 'error',
      });
    }
  });
});

/**
 * Get session history
 */
agent.get('/session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  // TODO: Implement session retrieval from MCP server
  return c.json({
    sessionId,
    messages: [],
    message: 'Session history not yet implemented',
  });
});

/**
 * Clear session
 */
agent.delete('/session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  // TODO: Implement session clearing via MCP server
  return c.json({
    sessionId,
    cleared: true,
  });
});

export { agent };
