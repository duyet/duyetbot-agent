import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { D1Storage } from './storage/d1.js';
import { KVStorage } from './storage/kv.js';
import type { Env } from './types.js';

import { authenticate, authenticateSchema } from './tools/authenticate.js';
import { getMemory, getMemorySchema } from './tools/get-memory.js';
import { listSessions, listSessionsSchema } from './tools/list-sessions.js';
import { saveMemory, saveMemorySchema } from './tools/save-memory.js';
import { searchMemory, searchMemorySchema } from './tools/search-memory.js';

// Context for authenticated requests
interface AuthContext {
  userId?: string;
}

export function createMCPServer(env: Env) {
  const d1Storage = new D1Storage(env.DB);
  const kvStorage = new KVStorage(env.KV);

  const server = new McpServer({
    name: 'duyetbot-memory',
    version: '1.0.0',
  });

  // Register authenticate tool
  server.tool(
    'authenticate',
    'Authenticate user via GitHub token',
    {
      github_token: z.string().optional().describe('GitHub personal access token'),
      oauth_code: z.string().optional().describe('OAuth authorization code (not yet implemented)'),
    },
    async (args) => {
      try {
        const input = authenticateSchema.parse(args);
        const result = await authenticate(input, d1Storage);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    }
  );

  // Register get_memory tool
  server.tool(
    'get_memory',
    'Retrieve session messages and context',
    {
      session_id: z.string().describe('The session ID to retrieve'),
      limit: z.number().optional().describe('Maximum number of messages to return'),
      offset: z.number().optional().describe('Number of messages to skip'),
    },
    async (args, extra) => {
      try {
        const input = getMemorySchema.parse(args);
        const userId = (extra as AuthContext).userId;
        if (!userId) {
          throw new Error('Authentication required');
        }
        const result = await getMemory(input, d1Storage, kvStorage, userId);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    }
  );

  // Register save_memory tool
  server.tool(
    'save_memory',
    'Save messages to session',
    {
      session_id: z.string().optional().describe('Session ID (creates new if not provided)'),
      messages: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string(),
            timestamp: z.number().optional(),
          })
        )
        .describe('Array of messages to save'),
      metadata: z.record(z.unknown()).optional().describe('Additional metadata to store'),
    },
    async (args, extra) => {
      try {
        const input = saveMemorySchema.parse(args);
        const userId = (extra as AuthContext).userId;
        if (!userId) {
          throw new Error('Authentication required');
        }
        const result = await saveMemory(input, d1Storage, kvStorage, userId);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    }
  );

  // Register search_memory tool
  server.tool(
    'search_memory',
    'Search across all user sessions',
    {
      query: z.string().describe('Search query'),
      limit: z.number().optional().describe('Maximum results to return'),
      filter: z
        .object({
          session_id: z.string().optional(),
          date_range: z
            .object({
              start: z.number().optional(),
              end: z.number().optional(),
            })
            .optional(),
        })
        .optional()
        .describe('Filter options'),
    },
    async (args, extra) => {
      try {
        const input = searchMemorySchema.parse(args);
        const userId = (extra as AuthContext).userId;
        if (!userId) {
          throw new Error('Authentication required');
        }
        const result = await searchMemory(input, d1Storage, kvStorage, userId);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    }
  );

  // Register list_sessions tool
  server.tool(
    'list_sessions',
    "List user's sessions",
    {
      limit: z.number().optional().describe('Maximum sessions to return'),
      offset: z.number().optional().describe('Number of sessions to skip'),
      state: z
        .enum(['active', 'paused', 'completed'])
        .optional()
        .describe('Filter by session state'),
    },
    async (args, extra) => {
      try {
        const input = listSessionsSchema.parse(args);
        const userId = (extra as AuthContext).userId;
        if (!userId) {
          throw new Error('Authentication required');
        }
        const result = await listSessions(input, d1Storage, kvStorage, userId);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    }
  );

  return server;
}

// Export for standalone MCP server usage
export async function runStdioServer(env: Env) {
  const server = createMCPServer(env);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
