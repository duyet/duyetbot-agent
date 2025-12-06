/**
 * ChatAgent - Reusable chat agent with LLM and tool support
 */
import { formatForLLM, trimHistory } from './history.js';
import { fromMemoryMessage } from './memory-adapter.js';
/**
 * ChatAgent handles conversation with LLM including tool calling
 */
export class ChatAgent {
  messages = [];
  llmProvider;
  systemPrompt;
  maxHistory;
  tools;
  onToolCall;
  maxToolIterations;
  memoryAdapter;
  sessionId;
  autoSave;
  memoryLoaded = false;
  constructor(config) {
    this.llmProvider = config.llmProvider;
    this.systemPrompt = config.systemPrompt;
    this.maxHistory = config.maxHistory ?? 20;
    this.tools = config.tools ?? [];
    this.onToolCall = config.onToolCall;
    this.maxToolIterations = config.maxToolIterations ?? 5;
    this.memoryAdapter = config.memoryAdapter;
    this.sessionId = config.sessionId;
    this.autoSave = config.autoSave ?? config.memoryAdapter !== undefined;
  }
  /**
   * Send a message and get a response
   */
  async chat(userMessage) {
    const trimmedMessage = userMessage.trim();
    if (!trimmedMessage) {
      return 'Please send a message.';
    }
    if (trimmedMessage.length > 4096) {
      return 'Message is too long (max 4096 characters).';
    }
    // Load memory on first message if adapter is configured
    if (this.memoryAdapter && this.sessionId && !this.memoryLoaded) {
      await this.loadMemory();
    }
    // Add user message to history
    this.messages.push({ role: 'user', content: trimmedMessage });
    // Format tools for OpenAI API
    const openAITools =
      this.tools.length > 0
        ? this.tools.map((t) => ({
            type: 'function',
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
    // Auto-save if configured
    if (this.autoSave && this.memoryAdapter && this.sessionId) {
      await this.saveMemory();
    }
    return responseText;
  }
  /**
   * Call the LLM provider
   */
  async callLLM(tools) {
    const llmMessages = formatForLLM(this.messages, this.systemPrompt);
    return this.llmProvider.chat(llmMessages, tools);
  }
  /**
   * Execute a tool call
   */
  async executeToolCall(toolCall) {
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
  getMessages() {
    return [...this.messages];
  }
  /**
   * Set message history (for restoring state)
   */
  setMessages(messages) {
    this.messages = [...messages];
  }
  /**
   * Clear conversation history
   */
  clearHistory() {
    this.messages = [];
  }
  /**
   * Get message count
   */
  getMessageCount() {
    return this.messages.length;
  }
  /**
   * Update available tools
   */
  setTools(tools) {
    this.tools = tools;
  }
  /**
   * Update system prompt
   */
  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
  }
  /**
   * Set session ID for memory persistence
   */
  setSessionId(sessionId) {
    this.sessionId = sessionId;
    this.memoryLoaded = false;
  }
  /**
   * Get current session ID
   */
  getSessionId() {
    return this.sessionId;
  }
  /**
   * Set memory adapter
   */
  setMemoryAdapter(adapter) {
    this.memoryAdapter = adapter;
    this.memoryLoaded = false;
  }
  /**
   * Load messages from memory adapter
   */
  async loadMemory() {
    if (!this.memoryAdapter || !this.sessionId) {
      return;
    }
    try {
      const data = await this.memoryAdapter.getMemory(this.sessionId);
      if (data.messages.length > 0) {
        this.messages = data.messages.map(fromMemoryMessage);
      }
      this.memoryLoaded = true;
    } catch {
      // Session may not exist yet, that's okay
      this.memoryLoaded = true;
    }
  }
  /**
   * Save messages to memory adapter
   */
  async saveMemory(metadata) {
    if (!this.memoryAdapter || !this.sessionId) {
      return;
    }
    await this.memoryAdapter.saveMemory(this.sessionId, this.messages, metadata);
  }
  /**
   * Search memory
   */
  async searchMemory(query, options) {
    if (!this.memoryAdapter?.searchMemory) {
      return [];
    }
    const results = await this.memoryAdapter.searchMemory(query, options);
    return results.map((r) => ({
      sessionId: r.sessionId,
      message: fromMemoryMessage(r.message),
      score: r.score,
    }));
  }
}
