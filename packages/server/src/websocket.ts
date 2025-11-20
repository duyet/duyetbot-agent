/**
 * WebSocket Server
 *
 * Real-time streaming support for agent responses
 */

import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { AgentSessionManager } from './session-manager.js';

export interface WebSocketMessage {
  type: 'chat' | 'subscribe' | 'unsubscribe' | 'ping';
  session_id?: string;
  message?: string;
  user_id?: string;
}

export interface WebSocketResponse {
  type: 'chunk' | 'done' | 'error' | 'pong' | 'subscribed' | 'unsubscribed';
  session_id?: string;
  data?: string;
  error?: string;
}

/**
 * WebSocket connection handler
 */
export class AgentWebSocketServer {
  private wss: WebSocketServer;
  private sessionManager: AgentSessionManager;
  private subscriptions = new Map<WebSocket, Set<string>>();

  constructor(server: Server, sessionManager: AgentSessionManager) {
    this.sessionManager = sessionManager;
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

    // TODO: Implement actual agent streaming
    // For now, simulate streaming response
    const responseText = `Echo: ${message.message}`;
    const chunks = responseText.split(' ');

    for (const chunk of chunks) {
      this.send(ws, {
        type: 'chunk',
        session_id: message.session_id,
        data: chunk + ' ',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Add assistant message
    const assistantMessage = { role: 'assistant' as const, content: responseText };
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
      data: responseText,
    });
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
  sessionManager: AgentSessionManager
): AgentWebSocketServer {
  return new AgentWebSocketServer(server, sessionManager);
}
