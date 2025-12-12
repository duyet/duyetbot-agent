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
 * Agent metadata for self-registration.
 * Each agent declares what queries it can handle.
 */
export interface AgentDefinition {
  /** Unique agent identifier (kebab-case, e.g., 'duyet-info-agent') */
  name: string;

  /** Human-readable description for LLM classification */
  description: string;

  /** Example queries this agent handles (for LLM few-shot learning) */
  examples?: string[];

  /** Keywords/patterns for quick classification (before LLM) */
  triggers?: {
    /** Keywords that indicate this agent (case-insensitive) */
    keywords?: string[];
    /** Regex patterns for quick matching */
    patterns?: RegExp[];
    /** Query categories this agent handles */
    categories?: string[];
    /** Patterns that should NOT match this agent (exclusions take precedence) */
    excludePatterns?: RegExp[];
  };

  /** Agent capabilities */
  capabilities?: {
    /** Tools this agent has access to */
    tools?: string[];
    /** Expected complexity level */
    complexity?: 'low' | 'medium' | 'high';
    /** Whether this agent needs human approval for actions */
    requiresApproval?: boolean;
  };

  /**
   * Priority for conflict resolution (higher = checked first).
   * Recommended ranges:
   * - 100: HITL/approval agents (always check first)
   * - 60-80: Specialized agents (research, news)
   * - 40-60: Domain agents (duyet, code)
   * - 10-30: General/fallback agents (simple)
   */
  priority?: number;
}

/**
 * Registry of all available agents.
 * Populated at startup when agent modules are imported.
 */
class AgentRegistryImpl {
  private agents = new Map<string, AgentDefinition>();

  /**
   * Register an agent definition.
   * Called by agents at module load time.
   */
  register(definition: AgentDefinition): void {
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
      hasExcludePatterns: !!definition.triggers?.excludePatterns?.length,
    });
  }

  /**
   * Unregister an agent (useful for testing).
   */
  unregister(name: string): boolean {
    return this.agents.delete(name);
  }

  /**
   * Get agent definition by name.
   */
  get(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all registered agents, sorted by priority (highest first).
   */
  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Get all registered agent names.
   */
  getNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Check if an agent is registered.
   */
  has(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Clear all registrations (useful for testing).
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Quick pattern matching before LLM classification.
   * Returns agent name if matched, null otherwise.
   *
   * Agents are checked in priority order (highest first).
   * Patterns are checked before keywords (more specific).
   */
  quickClassify(query: string): string | null {
    const lower = query.toLowerCase();

    for (const agent of this.getAll()) {
      if (!agent.triggers) {
        continue;
      }

      // Check exclusions first - if any exclude pattern matches, skip this agent
      if (agent.triggers.excludePatterns?.some((p) => p.test(lower))) {
        logger.debug('[AgentRegistry] Excluded via pattern', {
          agent: agent.name,
          query: query.slice(0, 50),
        });
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
  buildClassificationPrompt(): string {
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
      .flatMap((a) => a.examples!.map((ex) => `"${ex}" → ${a.name}`))
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
  getByCategory(category: string): AgentDefinition[] {
    return this.getAll().filter((a) => a.triggers?.categories?.includes(category));
  }

  /**
   * Get agent by tool.
   * Returns all agents that have access to the given tool.
   */
  getByTool(tool: string): AgentDefinition[] {
    return this.getAll().filter((a) => a.capabilities?.tools?.includes(tool));
  }
}

/**
 * Global agent registry singleton.
 * Agents register themselves when their modules are imported.
 */
export const agentRegistry = new AgentRegistryImpl();

/**
 * Type for agent registry (for testing/mocking).
 */
export type AgentRegistry = typeof agentRegistry;
