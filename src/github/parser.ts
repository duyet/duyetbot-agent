/**
 * GitHub Comment Parser
 *
 * Parse GitHub issue and PR comments for @duyetbot mentions
 */

import type { WebhookPayload } from './webhook-handler';

/**
 * Parsed comment data
 */
export interface ParsedComment {
  repository: string;
  repositoryUrl: string;
  issueNumber?: number | undefined;
  prNumber?: number | undefined;
  commentId?: number | undefined;
  command: string;
  fullText: string;
  author: string;
  url: string;
  context: {
    type: 'issue' | 'pull_request';
    title: string;
    body: string | null;
  };
}

/**
 * Extract command from text
 */
function extractCommand(text: string): string {
  // Remove @duyetbot mention and trim
  const cleaned = text.replace(/@duyetbot\b/gi, '').trim();

  // Remove code blocks and markdown
  const withoutCode = cleaned.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');

  return withoutCode.trim();
}

/**
 * Parse issue comment
 */
export function parseIssueComment(payload: WebhookPayload): ParsedComment {
  if (!payload.issue) {
    throw new Error('Missing issue in payload');
  }

  const text = payload.comment?.body || payload.issue.body || '';
  const command = extractCommand(text);

  return {
    repository: payload.repository.full_name,
    repositoryUrl: payload.repository.html_url,
    issueNumber: payload.issue.number,
    commentId: payload.comment?.id,
    command,
    fullText: text,
    author: payload.comment?.user.login || payload.issue.user.login,
    url: payload.comment?.html_url || payload.issue.html_url,
    context: {
      type: 'issue',
      title: payload.issue.title,
      body: payload.issue.body,
    },
  };
}

/**
 * Parse pull request comment
 */
export function parsePullRequestComment(payload: WebhookPayload): ParsedComment {
  if (!payload.pull_request) {
    throw new Error('Missing pull_request in payload');
  }

  const text = payload.comment?.body || payload.pull_request.body || '';
  const command = extractCommand(text);

  return {
    repository: payload.repository.full_name,
    repositoryUrl: payload.repository.html_url,
    prNumber: payload.pull_request.number,
    commentId: payload.comment?.id,
    command,
    fullText: text,
    author: payload.comment?.user.login || payload.pull_request.user.login,
    url: payload.comment?.html_url || payload.pull_request.html_url,
    context: {
      type: 'pull_request',
      title: payload.pull_request.title,
      body: payload.pull_request.body,
    },
  };
}

/**
 * Format response for GitHub comment
 */
export function formatGitHubComment(response: string, metadata?: Record<string, unknown>): string {
  const lines: string[] = [];

  // Add response
  lines.push(response);

  // Add metadata footer
  if (metadata) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>ℹ️ Details</summary>');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(metadata, null, 2));
    lines.push('```');
    lines.push('</details>');
  }

  // Add duyetbot signature
  lines.push('');
  lines.push('_— [@duyetbot](https://github.com/apps/duyetbot)_');

  return lines.join('\n');
}

/**
 * Extract code blocks from text
 */
export function extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
  const codeBlocks: Array<{ language: string; code: string }> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;

  let match: RegExpExecArray | null = regex.exec(text);
  while (match !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2] || '',
    });
    match = regex.exec(text);
  }

  return codeBlocks;
}

/**
 * Extract mentioned users
 */
export function extractMentions(text: string): string[] {
  const mentions: string[] = [];
  const regex = /@(\w+)/g;

  let match: RegExpExecArray | null = regex.exec(text);
  while (match !== null) {
    if (match[1] && match[1].toLowerCase() !== 'duyetbot') {
      mentions.push(match[1]);
    }
    match = regex.exec(text);
  }

  return [...new Set(mentions)];
}

/**
 * Extract issue references
 */
export function extractIssueReferences(
  text: string
): Array<{ repository?: string; issue: number }> {
  const references: Array<{ repository?: string; issue: number }> = [];

  // Match #123 or owner/repo#123
  const regex = /(?:(\w+\/\w+))?#(\d+)/g;

  let match: RegExpExecArray | null = regex.exec(text);
  while (match !== null) {
    references.push({
      ...(match[1] ? { repository: match[1] } : {}),
      issue: Number.parseInt(match[2] || '0', 10),
    });
    references.push({
      ...(match[1] ? { repository: match[1] } : {}),
      issue: Number.parseInt(match[2] || '0', 10),
    });
    references.push({
      ...(match[1] ? { repository: match[1] } : {}),
      issue: Number.parseInt(match[2] || '0', 10),
    });
    match = regex.exec(text);
  }

  return references;
}
