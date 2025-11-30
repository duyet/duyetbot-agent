/**
 * Mention Parser
 *
 * Platform-agnostic utilities for parsing @mentions and commands from messages.
 * Used by both Telegram and GitHub bots for consistent mention handling.
 */

/**
 * Parsed mention result
 */
export interface ParsedMention {
  /** Whether a mention was found */
  found: boolean;
  /** The task/message after the mention */
  task: string;
  /** The full matched string including mention */
  fullMatch: string;
}

/**
 * Parsed command result
 */
export interface ParsedCommand {
  /** The command name (lowercase) */
  command: string;
  /** Arguments after the command */
  args: string;
}

/**
 * Default commands recognized across platforms
 */
export const DEFAULT_COMMANDS = [
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
  'debug',
  'status',
] as const;

export type DefaultCommand = (typeof DEFAULT_COMMANDS)[number];

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse @username mention from text
 *
 * Supports multiline tasks up to next blank line or end of text.
 *
 * @param text - The text to parse
 * @param username - The bot username to match (without @)
 * @returns Parsed mention result
 */
export function parseMention(text: string, username: string): ParsedMention {
  // Match @username followed by task description
  // Supports multiline tasks up to next blank line or end
  const mentionRegex = new RegExp(
    `@${escapeRegex(username)}\\s+([^\\n]+(?:\\n(?!\\n)[^\\n]*)*)`,
    'i'
  );

  const match = text.match(mentionRegex);

  if (!match) {
    return {
      found: false,
      task: '',
      fullMatch: '',
    };
  }

  // match[0] is always defined, match[1] is the capture group
  const taskGroup = match[1] ?? '';
  return {
    found: true,
    task: taskGroup.trim(),
    fullMatch: match[0],
  };
}

/**
 * Check if text contains a mention of the given username
 *
 * @param text - The text to check
 * @param username - The username to look for (without @)
 * @returns True if mention found
 */
export function hasMention(text: string, username: string): boolean {
  const regex = new RegExp(`@${escapeRegex(username)}\\b`, 'i');
  return regex.test(text);
}

/**
 * Extract all mentions of a username from text
 *
 * @param text - The text to parse
 * @param username - The username to extract (without @)
 * @returns Array of task strings after each mention
 */
export function extractAllMentions(text: string, username: string): string[] {
  const regex = new RegExp(`@${escapeRegex(username)}\\s+([^\\n]+)`, 'gi');
  const matches: string[] = [];

  let match = regex.exec(text);
  while (match !== null) {
    const taskGroup = match[1] ?? '';
    matches.push(taskGroup.trim());
    match = regex.exec(text);
  }

  return matches;
}

/**
 * Check if text is a command (starts with / or a known command word)
 *
 * @param text - The text to check
 * @param commands - Optional custom command list
 * @returns True if text is a command
 */
export function isCommand(text: string, commands: readonly string[] = DEFAULT_COMMANDS): boolean {
  const trimmed = text.trim();

  // Slash commands
  if (trimmed.startsWith('/')) {
    return true;
  }

  // Word commands
  const parts = trimmed.split(/\s+/);
  const firstWord = parts[0] ?? '';
  return commands.includes(firstWord.toLowerCase());
}

/**
 * Parse a command string into command name and arguments
 *
 * @param text - The command text (with or without leading /)
 * @returns Parsed command with name and args
 */
export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();

  // Remove leading slash if present
  const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

  const parts = withoutSlash.split(/\s+/);
  const firstPart = parts[0] ?? '';
  const command = firstPart.toLowerCase();
  const args = parts.slice(1).join(' ');

  return { command, args };
}

/**
 * Extract task text after removing mention
 *
 * @param text - Full text with mention
 * @param username - Bot username to remove
 * @returns Task text without the @mention prefix
 */
export function extractTask(text: string, username: string): string {
  const parsed = parseMention(text, username);
  return parsed.found ? parsed.task : text.trim();
}
