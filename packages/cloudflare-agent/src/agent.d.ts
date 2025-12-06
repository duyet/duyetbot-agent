/**
 * ChatAgent - Reusable chat agent with LLM and tool support
 */
import type { MemoryAdapter } from './memory-adapter.js';
import type { ChatAgentConfig, Message, Tool } from './types.js';
/**
 * ChatAgent handles conversation with LLM including tool calling
 */
export declare class ChatAgent {
  private messages;
  private llmProvider;
  private systemPrompt;
  private maxHistory;
  private tools;
  private onToolCall;
  private maxToolIterations;
  private memoryAdapter;
  private sessionId;
  private autoSave;
  private memoryLoaded;
  constructor(config: ChatAgentConfig);
  /**
   * Send a message and get a response
   */
  chat(userMessage: string): Promise<string>;
  /**
   * Call the LLM provider
   */
  private callLLM;
  /**
   * Execute a tool call
   */
  private executeToolCall;
  /**
   * Get current message history
   */
  getMessages(): Message[];
  /**
   * Set message history (for restoring state)
   */
  setMessages(messages: Message[]): void;
  /**
   * Clear conversation history
   */
  clearHistory(): void;
  /**
   * Get message count
   */
  getMessageCount(): number;
  /**
   * Update available tools
   */
  setTools(tools: Tool[]): void;
  /**
   * Update system prompt
   */
  setSystemPrompt(prompt: string): void;
  /**
   * Set session ID for memory persistence
   */
  setSessionId(sessionId: string): void;
  /**
   * Get current session ID
   */
  getSessionId(): string | undefined;
  /**
   * Set memory adapter
   */
  setMemoryAdapter(adapter: MemoryAdapter): void;
  /**
   * Load messages from memory adapter
   */
  loadMemory(): Promise<void>;
  /**
   * Save messages to memory adapter
   */
  saveMemory(metadata?: Record<string, unknown>): Promise<void>;
  /**
   * Search memory
   */
  searchMemory(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<
    Array<{
      sessionId: string;
      message: Message;
      score: number;
    }>
  >;
}
//# sourceMappingURL=agent.d.ts.map
