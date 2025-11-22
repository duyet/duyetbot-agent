/**
 * Type definitions for prompt builder
 */

/**
 * Priority levels for prompt sections
 */
export type SectionPriority = 'critical' | 'important' | 'optional';

/**
 * AI model types
 */
export type ModelType = 'haiku' | 'sonnet' | 'opus';

/**
 * Role types for the assistant
 */
export type RoleType = 'assistant' | 'researcher' | 'reviewer' | 'explainer';

/**
 * A single section of a prompt
 */
export interface PromptSection {
  name: string;
  content: string;
  priority: SectionPriority;
  tokenEstimate?: number;
}

/**
 * Context for prompt building
 */
export interface PromptContext {
  /** Bot/assistant name */
  botName?: string;
  /** Creator name */
  creator?: string;
  /** Channel (telegram, github, cli) */
  channel?: string;
  /** Current model being used */
  model?: ModelType;
  /** Additional custom context */
  [key: string]: string | undefined;
}

/**
 * GitHub-specific context
 */
export interface GitHubContext {
  repository: string;
  issueNumber: number;
  issueTitle: string;
  isPR?: boolean;
  author?: string;
  labels?: string[];
}

/**
 * Options for compiling a prompt
 */
export interface CompileOptions {
  /** Maximum tokens allowed */
  maxTokens?: number;
  /** Include only critical sections if over limit */
  truncateOptional?: boolean;
  /** Separator between sections */
  separator?: string;
}

/**
 * Result of prompt compilation
 */
export interface CompiledPrompt {
  /** The compiled prompt string */
  text: string;
  /** Estimated token count */
  tokenEstimate: number;
  /** Sections included */
  sections: string[];
  /** Sections truncated (if any) */
  truncated: string[];
}
