/**
 * @duyetbot/chat-agent
 *
 * Reusable chat agent with LLM and MCP tools support
 */

// Core agent
export { ChatAgent } from './agent.js';

// Factory
export { createAgent } from './factory.js';

// Cloudflare Durable Object wrapper
export {
  createCloudflareChatAgent,
  type CloudflareAgentConfig,
  type CloudflareAgentState,
  type CloudflareChatAgentNamespace,
} from './cloudflare-agent.js';

// Types
export type {
  AgentState,
  ChatAgentConfig,
  LLMMessage,
  LLMProvider,
  LLMResponse,
  Message,
  MessageRole,
  OpenAITool,
  Tool,
  ToolCall,
  ToolExecutor,
} from './types.js';

// Utilities
export { formatForLLM, getMessageText, trimHistory } from './history.js';
