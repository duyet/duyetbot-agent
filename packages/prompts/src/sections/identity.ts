/**
 * Identity Section
 *
 * Establishes the bot's identity, name, and creator.
 */

import type { PromptConfig } from '../types.js';

/**
 * Generate the identity section for a prompt
 * @param config - Prompt configuration with botName and creator
 */
export function identitySection(config: PromptConfig): string {
  return `You are ${config.botName}, an AI assistant created by ${config.creator}.`;
}
