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
 *   - id: prompt-builder:classifier
 *     config: {}
 * ```
 */

import { agentRegistry } from '../../packages/cloudflare-agent/src/agents/registry.js';

interface ProviderContext {
  vars?: Record<string, unknown>;
}

interface ProviderResponse {
  output: string;
  tokenUsage?: { total: number; prompt: number; completion: number };
  metadata?: Record<string, unknown>;
}

/**
 * Classifier provider that uses quick pattern matching
 * Returns the classified agent name
 */
export async function classifierProvider(
  prompt: string,
  _context: ProviderContext
): Promise<ProviderResponse> {
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

/**
 * Get classification metadata for debugging
 */
export async function classifierDebugProvider(
  prompt: string,
  _context: ProviderContext
): Promise<ProviderResponse> {
  const agentName = agentRegistry.quickClassify(prompt);
  const agent = agentName ? agentRegistry.get(agentName) : null;

  return {
    output: JSON.stringify({
      query: prompt,
      matched: agentName !== null,
      agentName: agentName || 'simple-agent',
      agentDescription: agent?.description,
      priority: agent?.priority,
      capabilities: agent?.capabilities,
    }),
    tokenUsage: { total: 0, prompt: 0, completion: 0 },
    metadata: {
      method: 'pattern-debug',
    },
  };
}

// Default export for promptfoo CLI
export default classifierProvider;
