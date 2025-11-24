/**
 * @duyetbot/chat-agent
 *
 * Reusable chat agent with LLM and MCP tools support
 */

// Core agent
export { ChatAgent } from './agent.js';

// Factory
export { createAgent } from './factory.js';

// Memory adapters
export type {
  MemoryAdapter,
  MemoryData,
  MemoryMessage,
  MemorySearchResult,
  SaveMemoryResult,
  SessionInfo,
} from './memory-adapter.js';
export { fromMemoryMessage, toMemoryMessage } from './memory-adapter.js';

export {
  createMCPMemoryAdapter,
  createResilientMCPMemoryAdapter,
  DEFAULT_MEMORY_MCP_URL,
  MCPMemoryAdapter,
  MCPMemoryAdapterError,
  ResilientMCPMemoryAdapter,
  type MCPMemoryAdapterConfig,
} from './mcp-memory-adapter.js';

// Service binding adapter (for Cloudflare Workers)
export {
  createServiceBindingMemoryAdapter,
  ServiceBindingMemoryAdapter,
  type MemoryServiceBinding,
  type ServiceBindingMemoryAdapterConfig,
} from './service-binding-adapter.js';

// Cloudflare Durable Object wrapper
export {
  createCloudflareChatAgent,
  type CloudflareAgentConfig,
  type CloudflareAgentState,
  type CloudflareChatAgentClass,
  type CloudflareChatAgentMethods,
  type CloudflareChatAgentNamespace,
  type MCPServerConnection,
} from './cloudflare-agent.js';

// Transport layer
export type {
  MessageRef,
  ParsedInput,
  Transport,
  TransportHooks,
} from './transport.js';

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
