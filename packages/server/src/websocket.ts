/**
 * WebSocket Server
 *
 * Real-time streaming support for agent responses
 */

import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { QueryOptions, SDKTool } from '@duyetbot/core/sdk';
import { createQueryController, streamQuery } from './sdk-adapter.js';
import type { AgentSessionManager } from './session-manager.js';

/**
 * WebSocket server configuration
 */
export interface WebSocketConfig {
  tools?: SDKTool[];
  systemPrompt?: string;
  model?: string;
}

export interface WebSocketMessage {
  type: 'chat' | 'subscribe' | 'unsubscribe' | 'ping';
  session_id?: string;
  message?: string;
  user_id?: string;
}

export interface WebSocketResponse {
  type: 'chunk' | 'done' | 'error' | 'pong' | 'subscribed' | 'unsubscribed' | 'tool_use' | 'tool_result' | 'tokens';
  session_id?: string;
  data?: string;
  error?: string;
  tool_name?: string;
  tool_input?: unknown;
  tokens?: { input: number; output: number; total: number };
  duration?: number;
}

/**
 * WebSocket connection handler
 */
export class AgentWebSocketServer {
  private wss: WebSocketServer;
  private sessionManager: AgentSessionManager;
  private subscriptions = new Map<WebSocket, Set<string>>();
  private activeControllers = new Map<string, ReturnType<typeof createQueryController>>();
  private config: WebSocketConfig;

  constructor(server: Server, sessionManager: AgentSessionManager, config?: WebSocketConfig) {
    this.sessionManager = sessionManager;
    this.config = config || {};
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket): void {
    this.subscriptions.set(ws, new Set());

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        await this.handleMessage(ws, message);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.send(ws, { type: 'error', error: errorMessage });
      }
    });

    ws.on('close', () => {
      this.subscriptions.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.subscriptions.delete(ws);
    });
  }

  private async handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      case 'subscribe':
        if (message.session_id) {
          const subs = this.subscriptions.get(ws);
          if (subs) {
            subs.add(message.session_id);
          }
          this.send(ws, { type: 'subscribed', session_id: message.session_id });
        }
        break;

      case 'unsubscribe':
        if (message.session_id) {
          const subs = this.subscriptions.get(ws);
          if (subs) {
            subs.delete(message.session_id);
          }
          this.send(ws, { type: 'unsubscribed', session_id: message.session_id });
        }
        break;

      case 'chat':
        await this.handleChat(ws, message);
        break;
    }
  }

  private async handleChat(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    if (!message.session_id || !message.message) {
      this.send(ws, { type: 'error', error: 'session_id and message are required' });
      return;
    }

    const session = await this.sessionManager.getSession(message.session_id);
    if (!session) {
      this.send(ws, { type: 'error', error: 'Session not found' });
      return;
    }

    // Add user message
    const userMessage = { role: 'user' as const, content: message.message };
    const updatedMessages = [...session.messages, userMessage];

    // Create query controller for interruption
    const controller = createQueryController();
    this.activeControllers.set(message.session_id, controller);

    try {
      // Build context from previous messages
      const systemPrompt = this.config.systemPrompt || 'You are a helpful AI assistant.';
      const contextPrompt = session.messages.length > 0
        ? `${systemPrompt}\n\nPrevious conversation:\n${session.messages.map(m => `${m.role}: ${m.content}`).join('\n')}`
        : systemPrompt;

      // Build query options
      const queryOptions: QueryOptions = {
        model: this.config.model || 'sonnet',
        tools: this.config.tools || [],
        systemPrompt: contextPrompt,
        sessionId: session.id,
      };

      // Stream SDK messages
      let fullResponse = '';
      for await (const sdkMessage of streamQuery(message.message, queryOptions, controller)) {
        switch (sdkMessage.type) {
          case 'assistant':
            // Stream assistant content
            this.send(ws, {
              type: 'chunk',
              session_id: message.session_id,
              data: sdkMessage.content,
            });
            fullResponse = sdkMessage.content;
            break;

          case 'tool_use':
            // Notify about tool usage
            this.send(ws, {
              type: 'tool_use',
              session_id: message.session_id,
              tool_name: sdkMessage.toolName,
              tool_input: sdkMessage.toolInput,
            });
            break;

          case 'tool_result':
            // Notify about tool result
            if (sdkMessage.isError) {
              this.send(ws, {
                type: 'tool_result',
                session_id: message.session_id,
                data: sdkMessage.content,
                error: sdkMessage.content,
              });
            } else {
              this.send(ws, {
                type: 'tool_result',
                session_id: message.session_id,
                data: sdkMessage.content,
              });
            }
            break;

          case 'result':
            // Final result with tokens
            fullResponse = sdkMessage.content;
            const tokenResponse: WebSocketResponse = {
              type: 'tokens',
              session_id: message.session_id,
              tokens: {
                input: sdkMessage.inputTokens || 0,
                output: sdkMessage.outputTokens || 0,
                total: sdkMessage.totalTokens || 0,
              },
            };
            if (sdkMessage.duration !== undefined) {
              tokenResponse.duration = sdkMessage.duration;
            }
            this.send(ws, tokenResponse);
            break;

          case 'system':
            // System messages (errors, etc.)
            if (sdkMessage.content.startsWith('Error:')) {
              this.send(ws, {
                type: 'error',
                session_id: message.session_id,
                error: sdkMessage.content,
              });
            }
            break;
        }
      }

      // Add assistant message
      const assistantMessage = { role: 'assistant' as const, content: fullResponse };
      updatedMessages.push(assistantMessage);

      // Update session
      await this.sessionManager.updateSession(message.session_id, {
        messages: updatedMessages,
      });

      this.send(ws, { type: 'done', session_id: message.session_id });

      // Notify subscribers
      this.broadcast(message.session_id, {
        type: 'chunk',
        session_id: message.session_id,
        data: fullResponse,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.send(ws, { type: 'error', session_id: message.session_id, error: errorMessage });
    } finally {
      this.activeControllers.delete(message.session_id);
    }
  }

  /**
   * Interrupt an active query
   */
  interrupt(sessionId: string): boolean {
    const controller = this.activeControllers.get(sessionId);
    if (controller) {
      controller.interrupt();
      return true;
    }
    return false;
  }

  private send(ws: WebSocket, response: WebSocketResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(response));
    }
  }

  private broadcast(sessionId: string, response: WebSocketResponse): void {
    for (const [ws, subs] of this.subscriptions) {
      if (subs.has(sessionId) && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
    }
  }

  /**
   * Close all connections
   */
  close(): void {
    for (const ws of this.wss.clients) {
      ws.close();
    }
    this.wss.close();
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.wss.clients.size;
  }
}

/**
 * Create WebSocket server
 */
export function createWebSocketServer(
  server: Server,
  sessionManager: AgentSessionManager,
  config?: WebSocketConfig
): AgentWebSocketServer {
  return new AgentWebSocketServer(server, sessionManager, config);
}
