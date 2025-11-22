/**
 * ChatAgent - Reusable chat agent with LLM and tool support
 */

import { formatForLLM, trimHistory } from './history.js';
import type {
  ChatAgentConfig,
  LLMProvider,
  Message,
  OpenAITool,
  Tool,
  ToolCall,
  ToolExecutor,
} from './types.js';

/**
 * ChatAgent handles conversation with LLM including tool calling
 */
export class ChatAgent {
  private messages: Message[] = [];
  private llmProvider: LLMProvider;
  private systemPrompt: string;
  private maxHistory: number;
  private tools: Tool[];
  private onToolCall: ToolExecutor | undefined;
  private maxToolIterations: number;

  constructor(config: ChatAgentConfig) {
    this.llmProvider = config.llmProvider;
    this.systemPrompt = config.systemPrompt;
    this.maxHistory = config.maxHistory ?? 20;
    this.tools = config.tools ?? [];
    this.onToolCall = config.onToolCall;
    this.maxToolIterations = config.maxToolIterations ?? 5;
  }

  /**
   * Send a message and get a response
   */
  async chat(userMessage: string): Promise<string> {
    const trimmedMessage = userMessage.trim();

    if (!trimmedMessage) {
      return 'Please send a message.';
    }

    if (trimmedMessage.length > 4096) {
      return 'Message is too long (max 4096 characters).';
    }

    // Add user message to history
    this.messages.push({ role: 'user', content: trimmedMessage });

    // Format tools for OpenAI API
    const openAITools: OpenAITool[] | undefined =
      this.tools.length > 0
        ? this.tools.map((t) => ({
            type: 'function' as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          }))
        : undefined;

    // Call LLM with potential tool loop
    let iterations = 0;
    let response = await this.callLLM(openAITools);

    // Handle tool calls
    while (
      response.toolCalls &&
      response.toolCalls.length > 0 &&
      this.onToolCall &&
      iterations < this.maxToolIterations
    ) {
      iterations++;

      // Add assistant message with tool calls indicator
      this.messages.push({
        role: 'assistant',
        content: response.content || '',
      });

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const result = await this.executeToolCall(toolCall);

        // Add tool result to messages
        this.messages.push({
          role: 'tool',
          content: result,
          toolCallId: toolCall.id,
          name: toolCall.name,
        });
      }

      // Call LLM again with tool results
      response = await this.callLLM(openAITools);
    }

    // Add final assistant response
    const responseText = response.content || 'Sorry, I could not generate a response.';
    this.messages.push({ role: 'assistant', content: responseText });

    // Trim history
    this.messages = trimHistory(this.messages, this.maxHistory);

    return responseText;
  }

  /**
   * Call the LLM provider
   */
  private async callLLM(tools?: OpenAITool[]) {
    const llmMessages = formatForLLM(this.messages, this.systemPrompt);
    return this.llmProvider.chat(llmMessages, tools);
  }

  /**
   * Execute a tool call
   */
  private async executeToolCall(toolCall: ToolCall): Promise<string> {
    if (!this.onToolCall) {
      return `Error: No tool executor configured for ${toolCall.name}`;
    }

    try {
      return await this.onToolCall(toolCall);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error executing tool ${toolCall.name}: ${message}`;
    }
  }

  /**
   * Get current message history
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Set message history (for restoring state)
   */
  setMessages(messages: Message[]): void {
    this.messages = [...messages];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Update available tools
   */
  setTools(tools: Tool[]): void {
    this.tools = tools;
  }

  /**
   * Update system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }
}
