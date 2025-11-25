/**
 * Agent Core
 *
 * Main orchestration layer for agent execution
 */

import type { ToolRegistry } from '@duyetbot/tools/registry';
import type { LLMMessage, LLMProvider, LLMResponse, ToolInput, ToolOutput } from '@duyetbot/types';
import type {
  CreateSessionInput,
  Session,
  SessionManager,
  SessionState,
  ToolResult,
} from './session.js';
import { SessionError } from './session.js';

/**
 * Agent configuration
 */
export interface AgentConfig {
  provider: LLMProvider;
  sessionManager: SessionManager;
  toolRegistry: ToolRegistry;
}

/**
 * Agent class - main orchestration layer
 */
export class Agent {
  private provider: LLMProvider;
  private sessionManager: SessionManager;
  private toolRegistry: ToolRegistry;

  constructor(config: AgentConfig) {
    this.provider = config.provider;
    this.sessionManager = config.sessionManager;
    this.toolRegistry = config.toolRegistry;
  }

  /**
   * Get provider
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Get session manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Get tool registry
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Create new session
   */
  async createSession(input: CreateSessionInput): Promise<Session> {
    return this.sessionManager.create(input);
  }

  /**
   * Get session by ID
   */
  async getSession(id: string): Promise<Session | undefined> {
    return this.sessionManager.get(id);
  }

  /**
   * List sessions
   */
  async listSessions(filter?: {
    state?: SessionState;
    metadata?: Record<string, unknown>;
  }): Promise<Session[]> {
    return this.sessionManager.list(filter);
  }

  /**
   * Delete session
   */
  async deleteSession(id: string): Promise<void> {
    return this.sessionManager.delete(id);
  }

  /**
   * Send message to LLM and stream responses
   */
  async *sendMessage(
    sessionId: string,
    messages: LLMMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number }
  ): AsyncGenerator<LLMResponse, void, unknown> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    }

    // Use session provider if configured, otherwise use agent default provider
    const provider = session.provider ? this.provider : this.provider;

    // Stream responses from provider
    yield* provider.query(messages, options);
  }

  /**
   * Add message to session
   */
  async addMessage(sessionId: string, message: LLMMessage): Promise<Session> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    }

    const messages = session.messages || [];
    messages.push(message);

    return this.sessionManager.update(sessionId, { messages });
  }

  /**
   * Execute tool directly
   */
  async executeTool(toolName: string, input: unknown): Promise<ToolOutput> {
    const toolInput: ToolInput = {
      content: input as string | Record<string, unknown>,
    };

    return this.toolRegistry.execute(toolName, toolInput);
  }

  /**
   * Execute tool and track in session
   */
  async executeToolInSession(
    sessionId: string,
    toolName: string,
    input: unknown
  ): Promise<ToolOutput> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    }

    const result = await this.executeTool(toolName, input);

    // Track tool result in session
    const toolResults = session.toolResults || [];
    const toolResult: ToolResult = {
      toolName,
      status: result.status === 'success' ? 'success' : 'error',
      output: result.content,
      ...(result.error && {
        error: { message: result.error.message, code: result.error.code || 'UNKNOWN_ERROR' },
      }),
      timestamp: new Date(),
    };
    toolResults.push(toolResult);

    await this.sessionManager.update(sessionId, { toolResults });

    return result;
  }

  /**
   * Pause session
   */
  async pauseSession(sessionId: string, resumeToken?: string): Promise<Session> {
    return this.sessionManager.pause(sessionId, resumeToken);
  }

  /**
   * Resume session
   */
  async resumeSession(sessionId: string): Promise<Session> {
    return this.sessionManager.resume(sessionId);
  }

  /**
   * Complete session
   */
  async completeSession(sessionId: string): Promise<Session> {
    return this.sessionManager.complete(sessionId);
  }

  /**
   * Fail session
   */
  async failSession(
    sessionId: string,
    error: { message: string; code: string; details?: unknown }
  ): Promise<Session> {
    return this.sessionManager.fail(sessionId, error);
  }

  /**
   * Cancel session
   */
  async cancelSession(sessionId: string): Promise<Session> {
    return this.sessionManager.cancel(sessionId);
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(
    sessionId: string,
    metadata: Record<string, unknown>
  ): Promise<Session> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    }

    const updatedMetadata = {
      ...session.metadata,
      ...metadata,
    };

    return this.sessionManager.update(sessionId, { metadata: updatedMetadata });
  }
}
