/**
 * Mode Types
 *
 * Type definitions for duyetbot-action execution modes.
 * Each mode defines its own behavior for trigger detection, prompt generation,
 * and GitHub operations.
 */

import type { Octokit } from '../github/api/client.js';
import type { GitHubContext } from '../github/context.js';

/**
 * Available execution modes
 */
export type ModeName = 'tag' | 'agent' | 'continuous';

/**
 * Auto-detected mode types (used by detector)
 */
export type AutoDetectedMode = ModeName;

/**
 * Mode context passed to mode methods
 */
export type ModeContext = {
  mode: ModeName;
  githubContext: GitHubContext;
  commentId?: number | undefined;
  baseBranch?: string | undefined;
  claudeBranch?: string | undefined;
  taskId?: string | undefined;
};

/**
 * Mode options passed to prepare method
 */
export type ModeOptions = {
  context: GitHubContext;
  octokit: Octokit;
  githubToken: string;
};

/**
 * Mode result returned from prepare method
 */
export type ModeResult = {
  commentId?: number | undefined;
  branchInfo: {
    baseBranch: string;
    claudeBranch?: string | undefined;
    currentBranch: string;
  };
  taskId?: string | undefined;
  shouldExecute: boolean;
  systemPrompt?: string | undefined;
};

/**
 * Mode interface for duyetbot-action execution modes.
 *
 * Each mode defines:
 * - When it should trigger
 * - How to prepare the GitHub environment
 * - What prompt to generate
 * - Whether to create tracking comments
 * - What tools are allowed/disallowed
 */
export type Mode = {
  name: ModeName;
  description: string;

  /**
   * Determines if this mode should trigger based on the GitHub context
   */
  shouldTrigger(context: GitHubContext): boolean;

  /**
   * Prepares the mode context with any additional data
   */
  prepareContext(context: GitHubContext, data?: Partial<ModeResult>): ModeContext;

  /**
   * Returns the list of tools that should be allowed for this mode
   */
  getAllowedTools(): string[];

  /**
   * Returns the list of tools that should be disallowed for this mode
   */
  getDisallowedTools(): string[];

  /**
   * Determines if this mode should create a tracking comment
   */
  shouldCreateTrackingComment(): boolean;

  /**
   * Generates the prompt for this mode
   */
  generatePrompt(context: ModeContext): string;

  /**
   * Prepares the GitHub environment for this mode
   * Creates comments, sets up branches, configures git, etc.
   */
  prepare(options: ModeOptions): Promise<ModeResult>;

  /**
   * Returns an optional system prompt to append to the base system prompt
   */
  getSystemPrompt?(context: ModeContext): string | undefined;
};
