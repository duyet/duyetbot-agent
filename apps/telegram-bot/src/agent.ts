/**
 * Telegram Agent using Cloudflare Agents SDK
 *
 * Stateful agent with built-in storage using Durable Objects.
 */

import { Agent, type AgentNamespace } from "agents";
import Anthropic from "@anthropic-ai/sdk";
import {
  TELEGRAM_SYSTEM_PROMPT,
  TELEGRAM_WELCOME_MESSAGE,
  TELEGRAM_HELP_MESSAGE,
} from "@duyetbot/prompts";

export interface Env {
  // Required
  TELEGRAM_BOT_TOKEN: string;
  ANTHROPIC_API_KEY: string;

  // Agent binding
  TelegramAgent: AgentNamespace<TelegramAgent>;

  // Optional
  TELEGRAM_WEBHOOK_SECRET?: string;
  ALLOWED_USERS?: string;
  MODEL?: string;
  AI_GATEWAY_URL?: string;
}

interface Message {
  role: "user" | "assistant";
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
  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    const messages: Message[] = [
      ...this.state.messages,
      { role: "user", content: userMessage },
    ];

    // Build messages for API
    const apiMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Call Anthropic API
    const anthropic = new Anthropic({
      apiKey: this.env.ANTHROPIC_API_KEY,
      baseURL: this.env.AI_GATEWAY_URL,
    });

    const response = await anthropic.messages.create({
      model: this.env.MODEL || "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: TELEGRAM_SYSTEM_PROMPT,
      messages: apiMessages,
    });

    // Extract response text
    const responseText =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Sorry, I could not generate a response.";

    // Update state with new messages
    this.setState({
      ...this.state,
      messages: [...messages, { role: "assistant", content: responseText }],
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
    return "Conversation history cleared.";
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
