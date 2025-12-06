/**
 * Agent Registry
 *
 * Self-registration pattern for agents. Each agent declares its own metadata
 * (name, description, triggers, capabilities) and the router dynamically
 * builds classification logic from these registrations.
 *
 * Benefits:
 * - Decoupled: Router doesn't need to know about specific agents
 * - Extensible: Add agent = add file with registration
 * - Maintainable: Remove agent = delete file, router auto-adapts
 * - LLM-Friendly: Dynamic prompt built from agent descriptions
 */
import { logger } from '@duyetbot/hono-middleware';

/**
 * Registry of all available agents.
 * Populated at startup when agent modules are imported.
 */
class AgentRegistryImpl {
  agents = new Map();
  /**
   * Register an agent definition.
   * Called by agents at module load time.
   */
  register(definition) {
    if (this.agents.has(definition.name)) {
      logger.warn('[AgentRegistry] Agent already registered, overwriting', {
        name: definition.name,
      });
    }
    this.agents.set(definition.name, definition);
    logger.debug('[AgentRegistry] Agent registered', {
      name: definition.name,
      priority: definition.priority ?? 0,
      hasPatterns: !!definition.triggers?.patterns?.length,
      hasKeywords: !!definition.triggers?.keywords?.length,
    });
  }
  /**
   * Unregister an agent (useful for testing).
   */
  unregister(name) {
    return this.agents.delete(name);
  }
  /**
   * Get agent definition by name.
   */
  get(name) {
    return this.agents.get(name);
  }
  /**
   * Get all registered agents, sorted by priority (highest first).
   */
  getAll() {
    return Array.from(this.agents.values()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
  /**
   * Get all registered agent names.
   */
  getNames() {
    return Array.from(this.agents.keys());
  }
  /**
   * Check if an agent is registered.
   */
  has(name) {
    return this.agents.has(name);
  }
  /**
   * Clear all registrations (useful for testing).
   */
  clear() {
    this.agents.clear();
  }
  /**
   * Quick pattern matching before LLM classification.
   * Returns agent name if matched, null otherwise.
   *
   * Agents are checked in priority order (highest first).
   * Patterns are checked before keywords (more specific).
   */
  quickClassify(query) {
    const lower = query.toLowerCase();
    for (const agent of this.getAll()) {
      if (!agent.triggers) {
        continue;
      }
      // Check patterns first (more specific)
      if (agent.triggers.patterns?.some((p) => p.test(lower))) {
        logger.debug('[AgentRegistry] Quick match via pattern', {
          agent: agent.name,
          query: query.slice(0, 50),
        });
        return agent.name;
      }
      // Check keywords (less specific, but still useful)
      if (agent.triggers.keywords?.some((k) => lower.includes(k.toLowerCase()))) {
        logger.debug('[AgentRegistry] Quick match via keyword', {
          agent: agent.name,
          query: query.slice(0, 50),
        });
        return agent.name;
      }
    }
    return null;
  }
  /**
   * Build dynamic LLM classification prompt from registered agents.
   * Used when quick classification doesn't match.
   */
  buildClassificationPrompt() {
    const agents = this.getAll();
    // Build agent descriptions section
    const agentDescriptions = agents
      .map((a) => {
        let desc = `- **${a.name}**: ${a.description}`;
        if (a.capabilities?.tools?.length) {
          desc += ` (Tools: ${a.capabilities.tools.join(', ')})`;
        }
        return desc;
      })
      .join('\n');
    // Build examples section from all agents
    const examples = agents
      .filter((a) => a.examples?.length)
      .flatMap((a) => a.examples.map((ex) => `"${ex}" → ${a.name}`))
      .join('\n');
    return `## Available Agents

${agentDescriptions}

## Examples

${examples}

## Instructions

Analyze the user query and determine which agent should handle it.
Return the agent name that best matches the query's intent and required capabilities.
If no agent is a good fit, return "simple-agent" as the fallback.`;
  }
  /**
   * Get agent by category.
   * Returns all agents that handle the given category.
   */
  getByCategory(category) {
    return this.getAll().filter((a) => a.triggers?.categories?.includes(category));
  }
  /**
   * Get agent by tool.
   * Returns all agents that have access to the given tool.
   */
  getByTool(tool) {
    return this.getAll().filter((a) => a.capabilities?.tools?.includes(tool));
  }
}
/**
 * Global agent registry singleton.
 * Agents register themselves when their modules are imported.
 */
export const agentRegistry = new AgentRegistryImpl();
