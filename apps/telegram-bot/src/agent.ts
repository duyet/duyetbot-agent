/**
 * Telegram Agent using Cloudflare Agents SDK
 *
 * Stateful agent with built-in storage using Durable Objects.
 * Uses @duyetbot/chat-agent for core chat logic.
 */

import {
  ChatAgent,
  type LLMMessage,
  type LLMProvider,
  type LLMResponse,
  type Message,
  type OpenAITool,
} from '@duyetbot/chat-agent';
import { registerMcpServer } from '@duyetbot/mcp-servers';
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
  AI_GATEWAY_PROVIDER?: string; // Default: openrouter
  AI_GATEWAY_API_KEY?: string; // Authenticated AI Gateway token
  WORKER_URL?: string; // Worker URL for MCP callback (e.g., https://duyetbot-telegram.workers.dev)
  GITHUB_TOKEN?: string; // GitHub token for github-mcp
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

interface AgentState {
  messages: Message[];
  userId: number;
  chatId: number;
  createdAt: number;
  updatedAt: number;
  mcpInitialized: boolean;
}

/**
 * Create an LLM provider that uses Cloudflare AI Gateway
 */
function createAIGatewayProvider(env: Env): LLMProvider {
  return {
    async chat(messages: LLMMessage[], tools?: OpenAITool[]): Promise<LLMResponse> {
      const gateway = env.AI.gateway(env.AI_GATEWAY_NAME);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (env.AI_GATEWAY_API_KEY) {
        headers['cf-aig-authorization'] = `Bearer ${env.AI_GATEWAY_API_KEY}`;
      }

      const query: Record<string, unknown> = {
        model: env.MODEL || 'x-ai/grok-4.1-fast',
        max_tokens: 1024,
        messages,
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        query.tools = tools;
        query.tool_choice = 'auto';
      }

      const response = await gateway.run({
        provider: env.AI_GATEWAY_PROVIDER || 'openrouter',
        endpoint: 'chat/completions',
        headers,
        query,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('AI Gateway error:', error);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = (await response.json()) as OpenAIResponse;
      const choice = data.choices?.[0]?.message;

      // Extract tool calls if present
      const toolCalls = choice?.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      return {
        content: choice?.content || '',
        toolCalls,
      };
    },
  };
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
    mcpInitialized: false,
  };

  private chatAgent: ChatAgent | null = null;

  /**
   * Called when agent starts or wakes from hibernation
   */
  async onStart(): Promise<void> {
    console.log('[Agent] onStart called');
  }

  /**
   * Lazily initialize MCP servers and ChatAgent on first use
   */
  private async ensureInitialized(): Promise<ChatAgent> {
    // Initialize MCP servers if not done
    if (!this.state.mcpInitialized) {
      const timeout = (ms: number) =>
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('MCP registration timeout')), ms)
        );

      try {
        await Promise.race([
          Promise.all([
            registerMcpServer(this, 'duyet-mcp', this.env),
            registerMcpServer(this, 'github-mcp', this.env),
          ]),
          timeout(10000),
        ]);

        this.setState({ ...this.state, mcpInitialized: true });
        console.log('[Agent] MCP servers initialized successfully');
      } catch (error) {
        console.error('[Agent] MCP initialization failed:', error);
      }
    }

    // Create ChatAgent if not exists
    if (!this.chatAgent) {
      const llmProvider = createAIGatewayProvider(this.env);

      this.chatAgent = new ChatAgent({
        llmProvider,
        systemPrompt: TELEGRAM_SYSTEM_PROMPT,
        maxHistory: 20,
        // TODO: Add MCP tools here when available
        // tools: getMcpTools(),
        // onToolCall: (call) => executeMcpTool(this, call),
      });

      // Restore messages from state
      if (this.state.messages.length > 0) {
        this.chatAgent.setMessages(this.state.messages);
      }
    }

    return this.chatAgent;
  }

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
    const agent = await this.ensureInitialized();

    const response = await agent.chat(userMessage);

    // Persist messages to Durable Object state
    this.setState({
      ...this.state,
      messages: agent.getMessages(),
      updatedAt: Date.now(),
    });

    return response;
  }

  /**
   * Clear conversation history
   */
  async clearHistory(): Promise<string> {
    if (this.chatAgent) {
      this.chatAgent.clearHistory();
    }

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
