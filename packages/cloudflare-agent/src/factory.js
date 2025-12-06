/**
 * Factory function for creating ChatAgent instances
 */
import { ChatAgent } from './agent.js';
/**
 * Create a new ChatAgent instance
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   llmProvider: myProvider,
 *   systemPrompt: 'You are a helpful assistant',
 *   tools: myTools,
 *   onToolCall: async (call) => executeMyTool(call),
 * });
 *
 * const response = await agent.chat('Hello!');
 * ```
 */
export function createAgent(config) {
  return new ChatAgent(config);
}
