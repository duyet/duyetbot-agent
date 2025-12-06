/**
 * Tool Confirmation Logic
 *
 * Handles detection and processing of tool confirmations from user messages.
 * Provides utilities for creating confirmation requests and parsing responses.
 */

import { AgentMixin } from '../agents/base-agent.js';
import type { ToolConfirmation } from '../routing/schemas.js';

/**
 * Risk assessment for tools
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Tool definition for confirmable tools
 */
export interface ConfirmableTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Risk level of this tool */
  riskLevel: RiskLevel;
  /** Tool requires confirmation before execution */
  requiresConfirmation: boolean;
  /** Confirmation expiry time in ms (default: 5 minutes) */
  confirmationExpiryMs?: number;
}

/**
 * Result of parsing a user message for confirmation intent
 */
export interface ConfirmationParseResult {
  /** Whether message is a confirmation response */
  isConfirmation: boolean;
  /** Type of response */
  action: 'approve' | 'reject' | 'none';
  /** Optional reason (for rejections) */
  reason?: string | undefined;
  /** Specific confirmation ID if mentioned */
  targetConfirmationId?: string | undefined;
}

/**
 * Default high-risk tools that require confirmation
 */
export const DEFAULT_HIGH_RISK_TOOLS: string[] = [
  'bash',
  'shell',
  'exec',
  'delete',
  'remove',
  'drop',
  'truncate',
  'write',
  'modify',
  'update',
  'deploy',
  'push',
  'merge',
  'publish',
];

/**
 * Default confirmation expiry time (5 minutes)
 */
export const DEFAULT_CONFIRMATION_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Approval patterns
 */
const APPROVAL_PATTERNS = [
  /^y(es)?$/i,
  /^ok(ay)?$/i,
  /^approve$/i,
  /^confirm$/i,
  /^go( ahead)?$/i,
  /^do it$/i,
  /^proceed$/i,
  /^execute$/i,
  /^run( it)?$/i,
  /^accept$/i,
  /^✅$/,
  /^👍$/,
];

/**
 * Rejection patterns
 */
const REJECTION_PATTERNS = [
  /^n(o)?$/i,
  /^cancel$/i,
  /^reject$/i,
  /^stop$/i,
  /^abort$/i,
  /^don'?t$/i,
  /^nope$/i,
  /^decline$/i,
  /^refuse$/i,
  /^❌$/,
  /^👎$/,
];

/**
 * Check if a message contains a tool confirmation response
 */
export function hasToolConfirmation(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  return (
    APPROVAL_PATTERNS.some((p) => p.test(trimmed)) ||
    REJECTION_PATTERNS.some((p) => p.test(trimmed))
  );
}

/**
 * Parse a user message for confirmation intent
 */
export function parseConfirmationResponse(message: string): ConfirmationParseResult {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // Check for approval
  if (APPROVAL_PATTERNS.some((p) => p.test(lower))) {
    return {
      isConfirmation: true,
      action: 'approve',
    };
  }

  // Check for rejection
  if (REJECTION_PATTERNS.some((p) => p.test(lower))) {
    // Extract reason if provided (e.g., "no, because it's dangerous")
    const reasonMatch = trimmed.match(/^(?:no|cancel|reject|stop),?\s*(.+)?$/i);
    return {
      isConfirmation: true,
      action: 'reject',
      reason: reasonMatch?.[1]?.trim(),
    };
  }

  // Check for specific confirmation ID reference
  const idMatch = trimmed.match(/(?:approve|reject|confirm)\s+(?:id[:\s]?)?([a-z0-9_-]+)/i);
  if (idMatch) {
    const action = /approve|confirm/i.test(trimmed) ? 'approve' : 'reject';
    return {
      isConfirmation: true,
      action,
      targetConfirmationId: idMatch[1],
    };
  }

  return {
    isConfirmation: false,
    action: 'none',
  };
}

/**
 * Determine risk level for a tool
 */
export function determineRiskLevel(toolName: string, args?: Record<string, unknown>): RiskLevel {
  const lowerName = toolName.toLowerCase();

  // High risk operations
  if (DEFAULT_HIGH_RISK_TOOLS.some((t) => lowerName.includes(t))) {
    return 'high';
  }

  // Check args for dangerous patterns
  if (args) {
    const argsStr = JSON.stringify(args).toLowerCase();
    if (
      argsStr.includes('delete') ||
      argsStr.includes('remove') ||
      argsStr.includes('drop') ||
      argsStr.includes('--force') ||
      argsStr.includes('-f ')
    ) {
      return 'high';
    }

    if (
      argsStr.includes('write') ||
      argsStr.includes('update') ||
      argsStr.includes('modify') ||
      argsStr.includes('create')
    ) {
      return 'medium';
    }
  }

  // Read operations are low risk
  if (
    lowerName.includes('read') ||
    lowerName.includes('get') ||
    lowerName.includes('list') ||
    lowerName.includes('search') ||
    lowerName.includes('query')
  ) {
    return 'low';
  }

  return 'medium';
}

/**
 * Check if a tool requires confirmation based on risk level
 */
export function requiresConfirmation(
  toolName: string,
  args?: Record<string, unknown>,
  threshold: RiskLevel = 'high'
): boolean {
  const riskLevel = determineRiskLevel(toolName, args);

  const riskOrder: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };

  return riskOrder[riskLevel] >= riskOrder[threshold];
}

/**
 * Create a tool confirmation request
 */
export function createToolConfirmation(
  toolName: string,
  toolArgs: Record<string, unknown>,
  description: string,
  expiryMs: number = DEFAULT_CONFIRMATION_EXPIRY_MS
): ToolConfirmation {
  const now = Date.now();
  const riskLevel = determineRiskLevel(toolName, toolArgs);

  return {
    id: AgentMixin.generateId('confirm'),
    toolName,
    toolArgs,
    description,
    riskLevel,
    status: 'pending',
    requestedAt: now,
    expiresAt: now + expiryMs,
  };
}

/**
 * Format a confirmation request for display to the user
 */
export function formatConfirmationRequest(confirmation: ToolConfirmation): string {
  const riskEmoji =
    confirmation.riskLevel === 'high' ? '🔴' : confirmation.riskLevel === 'medium' ? '🟡' : '🟢';

  const expiresIn = Math.max(0, Math.round((confirmation.expiresAt - Date.now()) / 1000 / 60));

  let message = `${riskEmoji} **Confirmation Required**\n\n`;
  message += `**Tool:** \`${confirmation.toolName}\`\n`;
  message += `**Risk Level:** ${confirmation.riskLevel}\n`;
  message += `**Description:** ${confirmation.description}\n`;

  if (Object.keys(confirmation.toolArgs).length > 0) {
    message += '\n**Arguments:**\n';
    message += '```json\n';
    message += JSON.stringify(confirmation.toolArgs, null, 2);
    message += '\n```\n';
  }

  message += `\n⏱️ Expires in ${expiresIn} minutes\n`;
  message += '\nReply **yes** to approve or **no** to reject.';

  return message;
}

/**
 * Format multiple confirmation requests for display
 */
export function formatMultipleConfirmations(confirmations: ToolConfirmation[]): string {
  if (confirmations.length === 0) {
    return 'No pending confirmations.';
  }

  if (confirmations.length === 1) {
    const first = confirmations[0];
    if (first) {
      return formatConfirmationRequest(first);
    }
  }

  let message = `⚠️ **${confirmations.length} Confirmations Required**\n\n`;

  for (let i = 0; i < confirmations.length; i++) {
    const c = confirmations[i];
    if (!c) {
      continue;
    }
    const riskEmoji = c.riskLevel === 'high' ? '🔴' : c.riskLevel === 'medium' ? '🟡' : '🟢';

    message += `**${i + 1}.** ${riskEmoji} \`${c.toolName}\` - ${c.description}\n`;
  }

  message += '\nReply **yes** to approve all or **no** to reject all.';
  message += '\nOr reply **approve 1** / **reject 2** for specific items.';

  return message;
}

/**
 * Validate that a confirmation is still valid (not expired)
 */
export function isConfirmationValid(confirmation: ToolConfirmation): boolean {
  return confirmation.status === 'pending' && confirmation.expiresAt > Date.now();
}

/**
 * Filter out expired confirmations
 */
export function filterExpiredConfirmations(confirmations: ToolConfirmation[]): ToolConfirmation[] {
  const now = Date.now();
  return confirmations.filter((c) => c.status !== 'pending' || c.expiresAt > now);
}
