/**
 * Identity Section
 *
 * Establishes the bot's identity, name, and creator.
 */
/**
 * Generate the identity section for a prompt
 * @param config - Prompt configuration with botName and creator
 */
export function identitySection(config) {
  return `You are ${config.botName}, an AI assistant created by ${config.creator}.`;
}
