/**
 * Transform slash command to natural language for LLM
 * e.g., "/translate hello" → "translate: hello"
 * e.g., "/math 1 + 1" → "math: 1 + 1"
 */
export function transformSlashCommand(text: string): string {
  // Remove leading slash and split into command + args
  const withoutSlash = text.slice(1);
  const spaceIndex = withoutSlash.indexOf(' ');

  if (spaceIndex === -1) {
    // Just command, no args: "/translate" → "translate"
    return withoutSlash;
  }

  const command = withoutSlash.slice(0, spaceIndex);
  const args = withoutSlash.slice(spaceIndex + 1).trim();

  // Format as "command: args" for clear intent
  return `${command}: ${args}`;
}
