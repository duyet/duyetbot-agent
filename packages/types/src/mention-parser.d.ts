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
export declare const DEFAULT_COMMANDS: readonly [
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
];
export type DefaultCommand = (typeof DEFAULT_COMMANDS)[number];
/**
 * Parse @username mention from text
 *
 * Supports multiline tasks up to next blank line or end of text.
 *
 * @param text - The text to parse
 * @param username - The bot username to match (without @)
 * @returns Parsed mention result
 */
export declare function parseMention(text: string, username: string): ParsedMention;
/**
 * Check if text contains a mention of the given username
 *
 * @param text - The text to check
 * @param username - The username to look for (without @)
 * @returns True if mention found
 */
export declare function hasMention(text: string, username: string): boolean;
/**
 * Extract all mentions of a username from text
 *
 * @param text - The text to parse
 * @param username - The username to extract (without @)
 * @returns Array of task strings after each mention
 */
export declare function extractAllMentions(text: string, username: string): string[];
/**
 * Check if text is a command (starts with / or a known command word)
 *
 * @param text - The text to check
 * @param commands - Optional custom command list
 * @returns True if text is a command
 */
export declare function isCommand(text: string, commands?: readonly string[]): boolean;
/**
 * Parse a command string into command name and arguments
 *
 * @param text - The command text (with or without leading /)
 * @returns Parsed command with name and args
 */
export declare function parseCommand(text: string): ParsedCommand;
/**
 * Extract task text after removing mention
 *
 * @param text - Full text with mention
 * @param username - Bot username to remove
 * @returns Task text without the @mention prefix
 */
export declare function extractTask(text: string, username: string): string;
//# sourceMappingURL=mention-parser.d.ts.map
