import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { D1Storage } from './storage/d1.js';
import { KVStorage } from './storage/kv.js';
import type { Env } from './types.js';

import { authenticate, authenticateSchema } from './tools/authenticate.js';
import { getMemory, getMemorySchema } from './tools/get-memory.js';
import { listSessions, listSessionsSchema } from './tools/list-sessions.js';
import { saveMemory, saveMemorySchema } from './tools/save-memory.js';
import { searchMemory, searchMemorySchema } from './tools/search-memory.js';

export function createMCPServer(env: Env) {
  const d1Storage = new D1Storage(env.DB);
  const kvStorage = new KVStorage(env.KV);

  const server = new Server(
    {
      name: 'duyetbot-memory',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'authenticate',
          description: 'Authenticate user via GitHub token',
          inputSchema: {
            type: 'object',
            properties: {
              github_token: {
                type: 'string',
                description: 'GitHub personal access token',
              },
              oauth_code: {
                type: 'string',
                description: 'OAuth authorization code (not yet implemented)',
              },
            },
          },
        },
        {
          name: 'get_memory',
          description: 'Retrieve session messages and context',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'The session ID to retrieve',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of messages to return',
              },
              offset: {
                type: 'number',
                description: 'Number of messages to skip',
              },
            },
            required: ['session_id'],
          },
        },
        {
          name: 'save_memory',
          description: 'Save messages to session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session ID (creates new if not provided)',
              },
              messages: {
                type: 'array',
                description: 'Array of messages to save',
                items: {
                  type: 'object',
                  properties: {
                    role: {
                      type: 'string',
                      enum: ['user', 'assistant', 'system'],
                    },
                    content: { type: 'string' },
                    timestamp: { type: 'number' },
                  },
                  required: ['role', 'content'],
                },
              },
              metadata: {
                type: 'object',
                description: 'Additional metadata to store',
              },
            },
            required: ['messages'],
          },
        },
        {
          name: 'search_memory',
          description: 'Search across all user sessions',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum results to return',
              },
              filter: {
                type: 'object',
                properties: {
                  session_id: { type: 'string' },
                  date_range: {
                    type: 'object',
                    properties: {
                      start: { type: 'number' },
                      end: { type: 'number' },
                    },
                  },
                },
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'list_sessions',
          description: "List user's sessions",
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum sessions to return',
              },
              offset: {
                type: 'number',
                description: 'Number of sessions to skip',
              },
              state: {
                type: 'string',
                enum: ['active', 'paused', 'completed'],
                description: 'Filter by session state',
              },
            },
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'authenticate': {
          const input = authenticateSchema.parse(args);
          const result = await authenticate(input, d1Storage);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        }

        case 'get_memory': {
          const input = getMemorySchema.parse(args);
          // Get user ID from request context (will be set by HTTP handler)
          const userId = (request as { userId?: string }).userId;
          if (!userId) {
            throw new Error('Authentication required');
          }
          const result = await getMemory(input, d1Storage, kvStorage, userId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        }

        case 'save_memory': {
          const input = saveMemorySchema.parse(args);
          const userId = (request as { userId?: string }).userId;
          if (!userId) {
            throw new Error('Authentication required');
          }
          const result = await saveMemory(input, d1Storage, kvStorage, userId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        }

        case 'search_memory': {
          const input = searchMemorySchema.parse(args);
          const userId = (request as { userId?: string }).userId;
          if (!userId) {
            throw new Error('Authentication required');
          }
          const result = await searchMemory(input, d1Storage, kvStorage, userId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        }

        case 'list_sessions': {
          const input = listSessionsSchema.parse(args);
          const userId = (request as { userId?: string }).userId;
          if (!userId) {
            throw new Error('Authentication required');
          }
          const result = await listSessions(input, d1Storage, kvStorage, userId);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  return server;
}

// Export for standalone MCP server usage
export async function runStdioServer(env: Env) {
  const server = createMCPServer(env);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
