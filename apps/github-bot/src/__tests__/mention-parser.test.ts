/**
 * Mention Parser Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseMention,
  hasMention,
  extractAllMentions,
  isCommand,
  parseCommand,
} from '../mention-parser.js';

describe('parseMention', () => {
  it('should parse simple mention', () => {
    const result = parseMention('@duyetbot review this PR');
    expect(result.found).toBe(true);
    expect(result.task).toBe('review this PR');
  });

  it('should parse mention with multiline task', () => {
    const body = '@duyetbot please review\nthe changes in this PR';
    const result = parseMention(body);
    expect(result.found).toBe(true);
    expect(result.task).toBe('please review\nthe changes in this PR');
  });

  it('should return not found for no mention', () => {
    const result = parseMention('Just a regular comment');
    expect(result.found).toBe(false);
    expect(result.task).toBe('');
  });

  it('should be case insensitive', () => {
    const result = parseMention('@DuyetBot help me');
    expect(result.found).toBe(true);
    expect(result.task).toBe('help me');
  });

  it('should handle custom bot username', () => {
    const result = parseMention('@mybot do something', 'mybot');
    expect(result.found).toBe(true);
    expect(result.task).toBe('do something');
  });

  it('should not match partial usernames', () => {
    const result = parseMention('@duyetbot123 not a match');
    expect(result.found).toBe(false);
  });

  it('should trim whitespace from task', () => {
    const result = parseMention('@duyetbot   review   ');
    expect(result.found).toBe(true);
    expect(result.task).toBe('review');
  });
});

describe('hasMention', () => {
  it('should return true for mention', () => {
    expect(hasMention('@duyetbot hello')).toBe(true);
  });

  it('should return false for no mention', () => {
    expect(hasMention('hello world')).toBe(false);
  });

  it('should handle mention at different positions', () => {
    expect(hasMention('Hey @duyetbot can you help?')).toBe(true);
    expect(hasMention('Thanks @duyetbot')).toBe(true);
  });
});

describe('extractAllMentions', () => {
  it('should extract single mention', () => {
    const mentions = extractAllMentions('@duyetbot review');
    expect(mentions).toEqual(['review']);
  });

  it('should extract multiple mentions', () => {
    const body = '@duyetbot review\n@duyetbot test';
    const mentions = extractAllMentions(body);
    expect(mentions).toEqual(['review', 'test']);
  });

  it('should return empty array for no mentions', () => {
    const mentions = extractAllMentions('no mentions here');
    expect(mentions).toEqual([]);
  });
});

describe('isCommand', () => {
  it('should recognize known commands', () => {
    expect(isCommand('review this PR')).toBe(true);
    expect(isCommand('help me')).toBe(true);
    expect(isCommand('test the changes')).toBe(true);
    expect(isCommand('fix the bug')).toBe(true);
    expect(isCommand('summarize the discussion')).toBe(true);
  });

  it('should return false for non-commands', () => {
    expect(isCommand('what is happening')).toBe(false);
    expect(isCommand('can you check')).toBe(false);
  });
});

describe('parseCommand', () => {
  it('should parse command and arguments', () => {
    const result = parseCommand('review the PR');
    expect(result.command).toBe('review');
    expect(result.args).toBe('the PR');
  });

  it('should handle command with no arguments', () => {
    const result = parseCommand('help');
    expect(result.command).toBe('help');
    expect(result.args).toBe('');
  });

  it('should lowercase command', () => {
    const result = parseCommand('REVIEW something');
    expect(result.command).toBe('review');
  });
});
