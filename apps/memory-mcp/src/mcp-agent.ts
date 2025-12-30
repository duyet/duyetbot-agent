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
import { addTask } from './tools/todo-tasks.js';
import { completeTask } from './tools/todo-tasks.js';
import { deleteTask } from './tools/todo-tasks.js';
import { listTasks } from './tools/todo-tasks.js';
import { taskStatusEnum } from './tools/todo-tasks.js';
import { updateTask } from './tools/todo-tasks.js';

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
 * - add_task: Add a new task to the todo list
 * - list_tasks: List tasks from the todo list
 * - update_task: Update an existing task
 * - complete_task: Mark a task as completed
 * - delete_task: Delete a task from the todo list
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

    // ========================================================================
    // Todo/Task Management Tools
    // ========================================================================

    // add_task tool
    this.server.tool(
      'add_task',
      'Add a new task to the todo list',
      {
        description: z.string().describe('Task description'),
        priority: z.number().min(1).max(10).optional().describe('Priority (1-10, default 5)'),
        due_date: z.number().optional().describe('Due date as Unix timestamp'),
        tags: z.array(z.string()).optional().describe('Tags for categorization'),
        parent_task_id: z.string().optional().describe('Parent task ID for subtasks'),
      },
      async ({ description, priority, due_date, tags, parent_task_id }) => {
        if (!this.state.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not authenticated' }) }],
            isError: true,
          };
        }

        try {
          const task = await addTask(
            {
              description,
              priority: priority ?? 5,
              due_date,
              tags: tags ?? [],
              parent_task_id
            },
            storage,
            this.state.userId
          );

          return {
            content: [{ type: 'text', text: JSON.stringify({ task }) }],
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

    // list_tasks tool
    this.server.tool(
      'list_tasks',
      'List tasks from the todo list',
      {
        status: taskStatusEnum.optional().describe('Filter by status'),
        limit: z.number().optional().default(20).describe('Maximum tasks to return'),
        offset: z.number().optional().default(0).describe('Number of tasks to skip'),
        parent_task_id: z.string().optional().describe('Filter by parent task ID'),
      },
      async ({ status, limit, offset, parent_task_id }) => {
        if (!this.state.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not authenticated' }) }],
            isError: true,
          };
        }

        try {
          const result = await listTasks(
            {
              status,
              limit: limit ?? 20,
              offset: offset ?? 0,
              parent_task_id
            },
            storage,
            this.state.userId
          );

          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
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

    // update_task tool
    this.server.tool(
      'update_task',
      'Update an existing task',
      {
        id: z.string().describe('Task ID to update'),
        description: z.string().optional().describe('New description'),
        status: taskStatusEnum.optional().describe('New status'),
        priority: z.number().min(1).max(10).optional().describe('New priority (1-10)'),
        due_date: z.number().optional().describe('New due date as Unix timestamp'),
        tags: z.array(z.string()).optional().describe('New tags'),
      },
      async ({ id, description, status, priority, due_date, tags }) => {
        if (!this.state.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not authenticated' }) }],
            isError: true,
          };
        }

        try {
          const task = await updateTask(
            { id, description, status, priority, due_date, tags },
            storage
          );

          return {
            content: [{ type: 'text', text: JSON.stringify({ task }) }],
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

    // complete_task tool
    this.server.tool(
      'complete_task',
      'Mark a task as completed',
      {
        id: z.string().describe('Task ID to complete'),
      },
      async ({ id }) => {
        if (!this.state.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not authenticated' }) }],
            isError: true,
          };
        }

        try {
          const task = await completeTask({ id }, storage);

          return {
            content: [{ type: 'text', text: JSON.stringify({ task }) }],
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

    // delete_task tool
    this.server.tool(
      'delete_task',
      'Delete a task from the todo list',
      {
        id: z.string().describe('Task ID to delete'),
      },
      async ({ id }) => {
        if (!this.state.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not authenticated' }) }],
            isError: true,
          };
        }

        try {
          const result = await deleteTask({ id }, storage);

          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
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
