/**
 * Slim CloudflareAgent Orchestrator (Phase 5 Refactoring)
 *
 * DEPRECATED: This is the legacy CloudflareAgent implementation for backward compatibility.
 * Use the new agent architecture (src/agents/chat-agent.ts) for new implementations.
 *
 * This file is a ~400-line slim orchestrator that delegates to extracted modules:
 * - BatchQueue: Two-batch message queue management
 * - BatchProcessor: Batch processing logic
 * - TransportManager: Platform-specific message handling
 * - ContextBuilder: Context reconstruction from batch messages
 * - StuckDetector: Hung batch detection and recovery
 * - Adapters: Observability, state reporting, message persistence
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │        CloudflareAgent (Slim Orchestrator ~400 LOC)         │
 * │  - Delegates to BatchQueue, BatchProcessor, TransportMgr    │
 * │  - Manages LLM calls via provider                           │
 * │  - Routes via CloudflareChatAgent pattern                   │
 * └─────────────────────────────────────────────────────────────┘
 *     ↓           ↓            ↓              ↓
 * ┌───────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐
 * │Batch  │ │Batch     │ │Transport   │ │Stuck     │
 * │Queue  │ │Processor │ │Manager     │ │Detector  │
 * └───────┘ └──────────┘ └────────────┘ └──────────┘
 *     ↓           ↓            ↓              ↓
 * ┌──────────────────────────────────────────────────┐
 * │        Adapter Layer (Observability, State)      │
 * └──────────────────────────────────────────────────┘
 */
import type { CloudflareAgentConfig, CloudflareChatAgentClass } from './types.js';
/**
 * Create a Cloudflare Durable Object Agent class with direct LLM integration
 *
 * This factory function creates a CloudflareChatAgent class that extends
 * the Cloudflare Agent base class with chat capabilities.
 *
 * @example
 * ```typescript
 * import { createCloudflareChatAgent } from '@duyetbot/cloudflare-agent';
 *
 * const TelegramAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 *   welcomeMessage: 'Hello!',
 * });
 * ```
 */
export declare function createCloudflareChatAgent<TEnv, TContext = unknown>(
  config: CloudflareAgentConfig<TEnv, TContext>
): CloudflareChatAgentClass<TEnv, TContext>;
export { createAdapterFactory, createAdapterFactoryWithOverrides } from './adapter-factory.js';
export type {
  CloudflareAgentConfig,
  CloudflareAgentState,
  CloudflareChatAgentMethods,
} from './types.js';
//# sourceMappingURL=cloudflare-agent.d.ts.map
