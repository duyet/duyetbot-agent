/**
 * Capabilities Section
 *
 * Lists what the bot can do for the user.
 */

/**
 * Default capabilities shared across most agents
 */
export const DEFAULT_CAPABILITIES = [
  'Answering questions clearly and concisely',
  'Writing, explaining, and debugging code',
  'Research and analysis',
  'Task planning and organization',
];

/**
 * Generate the capabilities section
 * @param capabilities - List of capability strings
 */
export function capabilitiesSection(capabilities: string[]): string {
  if (capabilities.length === 0) {
    return '';
  }

  return `<capabilities>
${capabilities.map((cap) => `- ${cap}`).join('\n')}
</capabilities>`;
}
