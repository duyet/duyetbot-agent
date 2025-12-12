/**
 * Approval Tool for Agentic Loop
 *
 * Requests human approval for sensitive or destructive operations.
 * Replaces the HITLAgent (Human-In-The-Loop) functionality by providing
 * a tool-based approval workflow that integrates with the agentic loop.
 *
 * Use this tool for:
 * - Deleting data or resources
 * - Force pushing code changes
 * - Making irreversible modifications
 * - Other operations flagged as high-risk
 *
 * The tool returns a "pending" status indicating human input is needed.
 * The transport layer (Telegram/GitHub) detects this and pauses for approval.
 *
 * @example
 * ```typescript
 * // Agent attempts to delete a file
 * // Tool automatically requests approval
 * const result = await approvalTool.execute({
 *   action: 'Delete file /tmp/data.json',
 *   reason: 'Cleaning up temporary test data',
 *   risk_level: 'high'
 * }, ctx);
 *
 * // Result:
 * // {
 * //   success: false,
 * //   output: "🔐 Approval Required\n\nAction: Delete file /tmp/data.json\n...",
 * //   data: { status: 'awaiting_approval' },
 * //   durationMs: 5
 * // }
 * ```
 */

import type { LoopTool, ToolResult } from '../types.js';

/**
 * Approval request data structure
 *
 * Tracks what approval was requested, why, and what risk level.
 * Can be used to generate approval prompts or webhooks.
 */
export interface ApprovalRequest {
  /** Description of the action requiring approval */
  action: string;
  /** Reason why this action is necessary */
  reason: string;
  /** Risk level: low, medium, high, or critical */
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  /** When the approval was requested */
  timestamp: number;
  /** Unique approval request ID for tracking */
  requestId: string;
}

/**
 * Format an approval request as a human-readable message
 *
 * @param request - The approval request to format
 * @returns Formatted message string
 */
function formatApprovalMessage(request: ApprovalRequest): string {
  const riskLevel = request.riskLevel || 'medium';
  const riskEmoji = {
    low: '🟡',
    medium: '🟠',
    high: '🔴',
    critical: '🚨',
  }[riskLevel];

  return [
    '🔐 Approval Required',
    '',
    `Action: ${request.action}`,
    `Reason: ${request.reason}`,
    `Risk Level: ${riskEmoji} ${riskLevel.toUpperCase()}`,
    '',
    'Please respond with: **approve** or **reject**',
  ].join('\n');
}

/**
 * Generate a unique approval request ID
 *
 * @returns Unique request ID
 */
function generateRequestId(): string {
  return `approval_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Approval tool for the agentic loop
 *
 * Requests human approval before executing sensitive or destructive actions.
 * Returns a special "awaiting_approval" marker that the transport layer detects.
 *
 * The loop pauses at this tool, and the user must respond with approval/rejection.
 * Once the user responds, the loop continues with the approval result.
 */
export const approvalTool: LoopTool = {
  name: 'request_approval',

  description:
    'Request human approval before executing a sensitive or destructive action. Use for operations like deleting data, force pushing, or making irreversible changes. The agent pauses and waits for human approval before proceeding.',

  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Clear, specific description of the action requiring approval',
      },
      reason: {
        type: 'string',
        description: 'Why this action is necessary and what problem it solves',
      },
      risk_level: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description:
          'Risk level assessment: low (easily reversible), medium (requires attention), high (significant impact), critical (irreversible/high-impact)',
      },
    },
    required: ['action', 'reason'],
  },

  execute: async (args, _ctx): Promise<ToolResult> => {
    const startTime = Date.now();

    try {
      // Extract and validate arguments
      const action = String(args.action || '').trim();
      const reason = String(args.reason || '').trim();
      const riskLevel = (args.risk_level as string | undefined) || 'medium';

      // Validate inputs
      if (!action) {
        return {
          success: false,
          output: 'Error: action description is required',
          error: 'action parameter is empty',
          durationMs: Date.now() - startTime,
        };
      }

      if (!reason) {
        return {
          success: false,
          output: 'Error: reason is required',
          error: 'reason parameter is empty',
          durationMs: Date.now() - startTime,
        };
      }

      // Validate risk level
      const validRiskLevels = ['low', 'medium', 'high', 'critical'];
      if (!validRiskLevels.includes(riskLevel)) {
        return {
          success: false,
          output: `Error: invalid risk level '${riskLevel}'. Must be one of: ${validRiskLevels.join(', ')}`,
          error: 'invalid risk_level',
          durationMs: Date.now() - startTime,
        };
      }

      // Create approval request
      const requestId = generateRequestId();
      const approvalRequest: ApprovalRequest = {
        action,
        reason,
        riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical',
        timestamp: Date.now(),
        requestId,
      };

      // Format the approval message
      const formattedMessage = formatApprovalMessage(approvalRequest);

      // Return approval request with special marker
      // success=false indicates the loop should pause for human input
      // data.status='awaiting_approval' tells transport layer to wait for approval
      return {
        success: false,
        output: formattedMessage,
        data: {
          status: 'awaiting_approval',
          requestId,
          request: approvalRequest,
        },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        output: `Error requesting approval: ${errorMessage}`,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Create an approval request with custom parameters
 *
 * Convenience function for testing or creating approval requests programmatically.
 *
 * @param action - Description of the action
 * @param reason - Why the action is necessary
 * @param riskLevel - Optional risk level (default: 'medium')
 * @returns ApprovalRequest object
 *
 * @example
 * ```typescript
 * const request = createApprovalRequest(
 *   'Delete production database',
 *   'Migrate to new database version',
 *   'critical'
 * );
 * ```
 */
export function createApprovalRequest(
  action: string,
  reason: string,
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
): ApprovalRequest {
  return {
    action,
    reason,
    riskLevel: riskLevel || 'medium',
    timestamp: Date.now(),
    requestId: generateRequestId(),
  };
}

/**
 * Format an approval result message for user response
 *
 * Provides a formatted response to show to the user once approval is given/denied.
 *
 * @param approved - Whether the action was approved
 * @param action - The action that was approved/rejected
 * @returns Formatted result message
 *
 * @example
 * ```typescript
 * const response = formatApprovalResult(true, 'Delete /tmp/data.json');
 * // "✅ Approved: Delete /tmp/data.json"
 * ```
 */
export function formatApprovalResult(approved: boolean, action: string): string {
  const icon = approved ? '✅' : '❌';
  const status = approved ? 'Approved' : 'Rejected';
  return `${icon} ${status}: ${action}`;
}
