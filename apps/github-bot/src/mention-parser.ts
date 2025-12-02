/**
 * Mention Parser
 *
 * Parses @duyetbot mentions from GitHub comments
 */

export interface ParsedMention {
  found: boolean;
  task: string;
  fullMatch: string;
}

/**
 * Parse @duyetbot mention from comment body
 */
export function parseMention(body: string, botUsername = 'duyetbot'): ParsedMention {
  // Match @duyetbot followed by task description
  // Supports multiline tasks up to next blank line or end of comment
  const mentionRegex = new RegExp(`@${botUsername}\\s+([^\\n]+(?:\\n(?!\\n)[^\\n]*)*)`, 'i');

  const match = body.match(mentionRegex);

  if (!match) {
    return {
      found: false,
      task: '',
      fullMatch: '',
    };
  }

  const task = match[1].trim();

  return {
    found: true,
    task,
    fullMatch: match[0],
  };
}

/**
 * Check if comment contains a mention
 */
export function hasMention(body: string, botUsername = 'duyetbot'): boolean {
  const regex = new RegExp(`@${botUsername}\\b`, 'i');
  return regex.test(body);
}

/**
 * Extract all mentions from a comment
 */
export function extractAllMentions(body: string, botUsername = 'duyetbot'): string[] {
  const regex = new RegExp(`@${botUsername}\\s+([^\\n]+)`, 'gi');
  const matches: string[] = [];

  let match = regex.exec(body);
  while (match !== null) {
    matches.push(match[1].trim());
    match = regex.exec(body);
  }

  return matches;
}

/**
 * Check if this is a command mention (starts with a known command)
 */
export function isCommand(task: string): boolean {
  const commands = [
    'help',
    'review',
    'summarize',
    'test',
    'fix',
    'explain',
    'research',
    'label',
    'close',
    'assign',
  ];

  const firstWord = task.split(/\s+/)[0].toLowerCase();
  return commands.includes(firstWord);
}

/**
 * Extract command and arguments from task
 */
export function parseCommand(task: string): { command: string; args: string } {
  const parts = task.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  return { command, args };
}
