/**
 * Agents Module
 *
 * Agent implementations for the routing/orchestration system.
 *
 * IMPORTANT: Agent modules must be imported BEFORE using routing functions
 * because agents self-register at module load time. The imports below
 * trigger registration in the agentRegistry.
 */

// Base agent utilities
export {
  type AgentContext,
  AgentMixin,
  type AgentResult,
  type BaseAgentConfig,
  type BaseAgentState,
  type CommonPlatformConfig,
  createBaseState,
  type GenericPlatformConfig,
  type GitHubPlatformConfig,
  getTypedAgent,
  isAgent,
  type PlatformConfig,
  type TelegramPlatformConfig,
} from './base-agent.js';

// Chat Agent - primary entry point
export {
  type ChatAgentClass,
  type ChatAgentConfig,
  type ChatAgentEnv,
  type ChatAgentMethods,
  type ChatAgentState,
  createChatAgent,
} from './chat-agent.js';
