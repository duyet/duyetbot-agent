/**
 * Telegram Agent using Cloudflare Agents SDK
 *
 * Stateful agent with built-in storage using Durable Objects.
 */

import {
  TELEGRAM_HELP_MESSAGE,
  TELEGRAM_SYSTEM_PROMPT,
  TELEGRAM_WELCOME_MESSAGE,
} from '@duyetbot/prompts';
import { Agent, type AgentNamespace } from 'agents';

export interface Env {
  // Required
  TELEGRAM_BOT_TOKEN: string;
  AI_GATEWAY_NAME: string; // AI Gateway name (e.g., "my-gateway")

  // Bindings
  AI: Ai;
  TelegramAgent: AgentNamespace<TelegramAgent>;

  // Optional
  TELEGRAM_WEBHOOK_SECRET?: string;
  ALLOWED_USERS?: string;
  MODEL?: string; // Default: x-ai/grok-4.1-fast
  OPENROUTER_API_KEY?: string; // Set in AI Gateway or pass here
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentState {
  messages: Message[];
  userId: number;
  chatId: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Telegram Agent with conversation history
 */
export class TelegramAgent extends Agent<Env, AgentState> {
  initialState: AgentState = {
    messages: [],
    userId: 0,
    chatId: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  /**
   * Initialize agent with user context
   */
  async init(userId: number, chatId: number): Promise<void> {
    if (this.state.userId === 0) {
      this.setState({
        ...this.state,
        userId,
        chatId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  /**
   * Chat with the agent
   */
  async chat(
    userMessage: string,
    ai: Ai,
    gatewayName: string,
    model?: string,
    apiKey?: string
  ): Promise<string> {
    const trimmedMessage = userMessage.trim();

    if (!trimmedMessage) {
      return 'Please send a message.';
    }

    if (trimmedMessage.length > 4096) {
      return 'Message is too long (max 4096 characters).';
    }

    // Add user message to history
    const messages: Message[] = [...this.state.messages, { role: 'user', content: trimmedMessage }];

    // Build messages for OpenAI-compatible API
    const apiMessages = [
      { role: 'system' as const, content: TELEGRAM_SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Call OpenRouter via AI Gateway binding
    const gateway = ai.gateway(gatewayName);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await gateway.run({
      provider: 'openrouter',
      endpoint: 'chat/completions',
      headers,
      query: {
        model: model || 'x-ai/grok-4.1-fast',
        max_tokens: 1024,
        messages: apiMessages,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI Gateway error:', error);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = (await response.json()) as OpenAIResponse;

    // Extract response text
    const responseText =
      data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Update state with new messages (keep last 20 for context)
    const MAX_HISTORY = 20;
    let updatedMessages = [...messages, { role: 'assistant' as const, content: responseText }];
    if (updatedMessages.length > MAX_HISTORY) {
      updatedMessages = updatedMessages.slice(-MAX_HISTORY);
    }

    this.setState({
      ...this.state,
      messages: updatedMessages,
      updatedAt: Date.now(),
    });

    return responseText;
  }

  /**
   * Clear conversation history
   */
  async clearHistory(): Promise<string> {
    this.setState({
      ...this.state,
      messages: [],
      updatedAt: Date.now(),
    });
    return 'Conversation history cleared.';
  }

  /**
   * Get welcome message
   */
  getWelcome(): string {
    return TELEGRAM_WELCOME_MESSAGE;
  }

  /**
   * Get help message
   */
  getHelp(): string {
    return TELEGRAM_HELP_MESSAGE;
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.state.messages.length;
  }
}
