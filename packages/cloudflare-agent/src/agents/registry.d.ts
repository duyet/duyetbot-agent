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
declare class AgentRegistryImpl {
  private agents;
  /**
   * Register an agent definition.
   * Called by agents at module load time.
   */
  register(definition: AgentDefinition): void;
  /**
   * Unregister an agent (useful for testing).
   */
  unregister(name: string): boolean;
  /**
   * Get agent definition by name.
   */
  get(name: string): AgentDefinition | undefined;
  /**
   * Get all registered agents, sorted by priority (highest first).
   */
  getAll(): AgentDefinition[];
  /**
   * Get all registered agent names.
   */
  getNames(): string[];
  /**
   * Check if an agent is registered.
   */
  has(name: string): boolean;
  /**
   * Clear all registrations (useful for testing).
   */
  clear(): void;
  /**
   * Quick pattern matching before LLM classification.
   * Returns agent name if matched, null otherwise.
   *
   * Agents are checked in priority order (highest first).
   * Patterns are checked before keywords (more specific).
   */
  quickClassify(query: string): string | null;
  /**
   * Build dynamic LLM classification prompt from registered agents.
   * Used when quick classification doesn't match.
   */
  buildClassificationPrompt(): string;
  /**
   * Get agent by category.
   * Returns all agents that handle the given category.
   */
  getByCategory(category: string): AgentDefinition[];
  /**
   * Get agent by tool.
   * Returns all agents that have access to the given tool.
   */
  getByTool(tool: string): AgentDefinition[];
}
/**
 * Global agent registry singleton.
 * Agents register themselves when their modules are imported.
 */
export declare const agentRegistry: AgentRegistryImpl;
/**
 * Type for agent registry (for testing/mocking).
 */
export type AgentRegistry = typeof agentRegistry;
//# sourceMappingURL=registry.d.ts.map
