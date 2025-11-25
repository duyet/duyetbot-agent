/**
 * Memory MCP Agent using Cloudflare Agents SDK
 *
 * Provides MCP tools for memory operations with D1 storage backend.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';
import { D1Storage } from './storage/d1.js';
import type { Env, LLMMessage } from './types.js';

/**
 * Agent state - tracks authenticated user
 */
interface MemoryAgentState {
  userId: string | null;
}

/**
 * Memory MCP Agent
 *
 * Provides tools for:
 * - get_memory: Retrieve messages for a session
 * - save_memory: Save messages to a session
 * - search_memory: Full-text search across messages
 * - list_sessions: List user's sessions
 */
export class MemoryMcpAgent extends McpAgent<Env, MemoryAgentState, Record<string, never>> {
  server = new McpServer({
    name: 'duyetbot-memory',
    version: '1.0.0',
  });

  override initialState: MemoryAgentState = {
    userId: null,
  };

  override async init() {
    const storage = new D1Storage(this.env.DB);

    // get_memory tool
    this.server.tool(
      'get_memory',
      'Retrieve messages for a session',
      {
        session_id: z.string().describe('Session ID to retrieve messages from'),
        limit: z.number().optional().describe('Maximum number of messages to return'),
        offset: z.number().optional().describe('Number of messages to skip'),
      },
      async ({ session_id, limit, offset }) => {
        if (!this.state.userId) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Not authenticated' }),
              },
            ],
            isError: true,
          };
        }

        try {
          // Verify session belongs to user
          const session = await storage.getSession(session_id);
          if (!session || session.user_id !== this.state.userId) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Session not found' }),
                },
              ],
              isError: true,
            };
          }

          const messages = await storage.getMessages(session_id, {
            ...(limit !== undefined && { limit }),
            ...(offset !== undefined && { offset }),
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  session_id,
                  messages,
                  metadata: session.metadata || {},
                }),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : 'Unknown error',
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );

    // save_memory tool
    this.server.tool(
      'save_memory',
      'Save messages to a session',
      {
        session_id: z.string().optional().describe('Session ID (auto-generated if not provided)'),
        messages: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant', 'system']),
              content: z.string(),
              timestamp: z.number().optional(),
              metadata: z.record(z.unknown()).optional(),
            })
          )
          .describe('Messages to save'),
        metadata: z.record(z.unknown()).optional().describe('Session metadata'),
      },
      async ({ session_id, messages, metadata }) => {
        if (!this.state.userId) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Not authenticated' }),
              },
            ],
            isError: true,
          };
        }

        try {
          // Create or get session
          let sessionId = session_id;
          if (!sessionId) {
            sessionId = crypto.randomUUID();
          }

          // Check if session exists
          const existing = await storage.getSession(sessionId);
          if (existing && existing.user_id !== this.state.userId) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Session not found' }),
                },
              ],
              isError: true,
            };
          }

          // Create session if it doesn't exist
          if (!existing) {
            const now = Date.now();
            await storage.createSession({
              id: sessionId,
              user_id: this.state.userId,
              title: null,
              state: 'active',
              metadata: metadata || null,
              created_at: now,
              updated_at: now,
            });
          }

          // Save messages
          const savedCount = await storage.saveMessages(sessionId, messages as LLMMessage[]);

          // Update session metadata if provided
          if (metadata && existing) {
            await storage.updateSession(sessionId, { metadata });
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  session_id: sessionId,
                  saved_count: savedCount,
                  updated_at: Date.now(),
                }),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : 'Unknown error',
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );

    // search_memory tool
    this.server.tool(
      'search_memory',
      'Search across all messages',
      {
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10).describe('Maximum results to return'),
        filter: z
          .object({
            session_id: z.string().optional(),
            date_range: z
              .object({
                start: z.number(),
                end: z.number(),
              })
              .optional(),
          })
          .optional()
          .describe('Optional filters'),
      },
      async ({ query, limit, filter }) => {
        if (!this.state.userId) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Not authenticated' }),
              },
            ],
            isError: true,
          };
        }

        try {
          const results = await storage.searchMessages(this.state.userId, query, {
            limit,
            ...(filter?.session_id && { sessionId: filter.session_id }),
            ...(filter?.date_range && { dateRange: filter.date_range }),
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ results }),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : 'Unknown error',
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );

    // list_sessions tool
    this.server.tool(
      'list_sessions',
      "List user's sessions",
      {
        limit: z.number().optional().default(20).describe('Maximum sessions to return'),
        offset: z.number().optional().default(0).describe('Number of sessions to skip'),
        state: z
          .enum(['active', 'paused', 'completed'])
          .optional()
          .describe('Filter by session state'),
      },
      async ({ limit, offset, state }) => {
        if (!this.state.userId) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Not authenticated' }),
              },
            ],
            isError: true,
          };
        }

        try {
          const result = await storage.listSessions(this.state.userId, {
            limit,
            offset,
            ...(state && { state }),
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : 'Unknown error',
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Set authenticated user ID
   */
  setUserId(userId: string) {
    this.setState({ ...this.state, userId });
  }
}

export default MemoryMcpAgent;
