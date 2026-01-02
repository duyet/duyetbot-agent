/**
 * Mode Registry
 *
 * Provides access to all available execution modes and handles automatic
 * mode detection based on GitHub event types.
 */

import type { GitHubContext } from '../github/context.js';
import { agentMode } from './agent/index.js';
import { continuousMode } from './continuous/index.js';
import { detectMode } from './detector.js';
// Import actual mode implementations
import { tagMode } from './tag/index.js';
import type { Mode, ModeName } from './types.js';

/**
 * All available mode names
 */
export const VALID_MODES: ModeName[] = ['tag', 'agent', 'continuous'];

/**
 * Mode instances registry
 */
const MODE_INSTANCES: Record<ModeName, Mode> = {
  tag: tagMode,
  agent: agentMode,
  continuous: continuousMode,
};

/**
 * Automatically detects and retrieves the appropriate mode based on the GitHub context.
 *
 * @param context The GitHub context
 * @returns The appropriate mode for the context
 */
export function getMode(context: GitHubContext): Mode {
  const modeName = detectMode(context);
  console.log(`Auto-detected mode: ${modeName} for event: ${context.eventName}`);

  const mode = getModeByName(modeName);

  if (!mode) {
    throw new Error(
      `Mode '${modeName}' not found. This should not happen. Please report this issue.`
    );
  }

  return mode;
}

/**
 * Gets a mode by name
 */
export function getModeByName(name: ModeName): Mode | null {
  return MODE_INSTANCES[name] || null;
}

/**
 * Type guard to check if a string is a valid mode name
 */
export function isValidMode(name: string): name is ModeName {
  return VALID_MODES.includes(name as ModeName);
}
