/**
 * Classifier Provider for Promptfoo
 *
 * Uses quick pattern-based classification for testing routing accuracy.
 * This does NOT call LLM - it uses the fast pattern matching only.
 *
 * Returns the classified agent name based on pattern/keyword matching.
 *
 * @example
 * ```yaml
 * providers:
 *   - id: file://providers/classifier-provider.ts
 * ```
 */

import { agentRegistry } from '../../packages/cloudflare-agent/src/agents/registry.js';

interface CallApiContext {
  vars?: Record<string, unknown>;
}

interface ProviderResponse {
  output: string;
  tokenUsage?: { total: number; prompt: number; completion: number };
  metadata?: Record<string, unknown>;
}

/**
 * Classifier provider class that uses quick pattern matching
 * Returns the classified agent name
 */
export default class ClassifierProvider {
  id(): string {
    return 'classifier-provider';
  }

  async callApi(prompt: string, _context?: CallApiContext): Promise<ProviderResponse> {
    // Use the agent registry's quick classify method
    const agentName = agentRegistry.quickClassify(prompt);

    return {
      output: agentName || 'simple-agent',
      tokenUsage: { total: 0, prompt: 0, completion: 0 },
      metadata: {
        query: prompt,
        matched: agentName !== null,
        method: 'pattern',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
