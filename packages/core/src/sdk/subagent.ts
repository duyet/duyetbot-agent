/**
 * SDK Subagent System
 *
 * Define and manage specialized subagents
 */

import type { QueryOptions } from './options.js';
import type { ModelType, SDKTool, SubagentConfig } from './types.js';

/**
 * Create a subagent configuration
 *
 * @example
 * ```typescript
 * const researcher = createSubagent({
 *   name: 'researcher',
 *   description: 'Research and gather information from the web',
 *   tools: ['web_search', 'fetch_url'],
 *   prompt: 'You are a research assistant...',
 *   model: 'haiku',
 * });
 * ```
 */
export function createSubagent(config: {
  name: string;
  description: string;
  tools?: string[];
  prompt?: string;
  model?: ModelType;
}): SubagentConfig {
  const result: SubagentConfig = {
    name: config.name,
    description: config.description,
  };
  if (config.tools) {
    result.tools = config.tools;
  }
  if (config.prompt) {
    result.prompt = config.prompt;
  }
  if (config.model) {
    result.model = config.model;
  }
  return result;
}

/**
 * Predefined subagent configurations for common use cases
 */
export const predefinedSubagents = {
  /**
   * Research agent for gathering information
   */
  researcher: createSubagent({
    name: 'researcher',
    description: 'Research and gather information from the web',
    tools: ['research', 'web_search', 'fetch_url'],
    prompt: `You are a research assistant. Your role is to:
- Search for and gather relevant information
- Summarize findings clearly and concisely
- Cite sources when appropriate
- Provide balanced perspectives on topics`,
    model: 'haiku',
  }),

  /**
   * Code reviewer agent
   */
  codeReviewer: createSubagent({
    name: 'code_reviewer',
    description: 'Review code for quality, security, and best practices',
    tools: ['bash', 'git'],
    prompt: `You are a code reviewer. Your role is to:
- Review code for bugs and potential issues
- Check for security vulnerabilities
- Suggest improvements and best practices
- Provide clear, actionable feedback`,
    model: 'sonnet',
  }),

  /**
   * Planner agent for task decomposition
   */
  planner: createSubagent({
    name: 'planner',
    description: 'Break down complex tasks into actionable steps',
    tools: ['plan'],
    prompt: `You are a planning assistant. Your role is to:
- Analyze complex tasks and break them down
- Identify dependencies between tasks
- Estimate complexity and time requirements
- Create clear, actionable plans`,
    model: 'haiku',
  }),

  /**
   * Git operations agent
   */
  gitOperator: createSubagent({
    name: 'git_operator',
    description: 'Perform git operations and manage version control',
    tools: ['git', 'bash'],
    prompt: `You are a git operations specialist. Your role is to:
- Perform git operations safely
- Create meaningful commit messages
- Manage branches and merges
- Handle conflicts and resolve issues`,
    model: 'haiku',
  }),

  /**
   * GitHub agent for API operations
   */
  githubAgent: createSubagent({
    name: 'github_agent',
    description: 'Interact with GitHub API for issues, PRs, and repositories',
    tools: ['github'],
    prompt: `You are a GitHub operations specialist. Your role is to:
- Manage issues and pull requests
- Create and update comments
- Perform code reviews
- Handle GitHub workflows`,
    model: 'haiku',
  }),
};

/**
 * Get a predefined subagent by name
 */
export function getPredefinedSubagent(name: keyof typeof predefinedSubagents): SubagentConfig {
  return predefinedSubagents[name];
}

/**
 * Filter tools for a subagent based on its allowed tools
 */
export function filterToolsForSubagent(allTools: SDKTool[], subagent: SubagentConfig): SDKTool[] {
  if (!subagent.tools || subagent.tools.length === 0) {
    return allTools;
  }

  return allTools.filter((tool) => subagent.tools!.includes(tool.name));
}

/**
 * Create options for subagent execution
 */
export function createSubagentOptions(
  parentOptions: QueryOptions,
  subagent: SubagentConfig,
  allTools: SDKTool[]
): QueryOptions {
  // Create result without resume/fork properties
  const { resume: _resume, forkSession: _fork, ...restOptions } = parentOptions;

  const result: QueryOptions = {
    ...restOptions,
    tools: filterToolsForSubagent(allTools, subagent),
    // Create new session for subagent
    sessionId: `${parentOptions.sessionId || 'main'}_${subagent.name}_${Date.now()}`,
  };

  // Only set if defined
  if (subagent.model) {
    result.model = subagent.model;
  } else if (parentOptions.model) {
    result.model = parentOptions.model;
  }

  if (subagent.prompt) {
    result.systemPrompt = subagent.prompt;
  } else if (parentOptions.systemPrompt) {
    result.systemPrompt = parentOptions.systemPrompt;
  }

  return result;
}

/**
 * Subagent registry for managing multiple subagents
 */
export class SubagentRegistry {
  private subagents = new Map<string, SubagentConfig>();

  /**
   * Register a subagent
   */
  register(subagent: SubagentConfig): void {
    this.subagents.set(subagent.name, subagent);
  }

  /**
   * Register multiple subagents
   */
  registerAll(subagents: SubagentConfig[]): void {
    for (const subagent of subagents) {
      this.register(subagent);
    }
  }

  /**
   * Get a subagent by name
   */
  get(name: string): SubagentConfig | undefined {
    return this.subagents.get(name);
  }

  /**
   * List all registered subagents
   */
  list(): SubagentConfig[] {
    return Array.from(this.subagents.values());
  }

  /**
   * Check if a subagent is registered
   */
  has(name: string): boolean {
    return this.subagents.has(name);
  }

  /**
   * Unregister a subagent
   */
  unregister(name: string): void {
    this.subagents.delete(name);
  }

  /**
   * Clear all subagents
   */
  clear(): void {
    this.subagents.clear();
  }

  /**
   * Get subagent metadata for LLM consumption
   */
  getMetadata(): Array<{ name: string; description: string }> {
    return this.list().map((agent) => ({
      name: agent.name,
      description: agent.description,
    }));
  }
}

/**
 * Create a new subagent registry
 */
export function createSubagentRegistry(): SubagentRegistry {
  return new SubagentRegistry();
}

/**
 * Create a registry with predefined subagents
 */
export function createDefaultSubagentRegistry(): SubagentRegistry {
  const registry = new SubagentRegistry();
  registry.registerAll(Object.values(predefinedSubagents));
  return registry;
}
