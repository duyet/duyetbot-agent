import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

export type PermissionLevel = 'dangerous' | 'safe' | 'approval_required';

export interface PermissionConfig {
  toolPermission: Map<string, PermissionLevel>;
  autoApprove?: string[];
  requireApproval?: string[];
  timeout?: number;
}

class PermissionManager {
  private config: PermissionConfig;
  private pendingApprovals = new Map<
    string,
    {
      toolName: string;
      args: Record<string, unknown>;
      requestedAt: number;
    }
  >();

  constructor(config: PermissionConfig) {
    this.config = config;
  }

  checkPermission(toolName: string): PermissionLevel {
    const level = this.config.toolPermission.get(toolName) || 'safe';

    if (level === 'safe') {
      return 'safe';
    }

    if (this.config.autoApprove?.includes(toolName)) {
      return 'safe';
    }

    if (this.config.requireApproval?.includes(toolName)) {
      return 'approval_required';
    }

    return level;
  }

  async requestApproval(toolName: string, args: Record<string, unknown>): Promise<boolean> {
    const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    this.pendingApprovals.set(approvalId, {
      toolName,
      args,
      requestedAt: Date.now(),
    });

    const timeout = this.config.timeout || 300000;

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.pendingApprovals.delete(approvalId);
        reject(new Error(`Approval timeout for ${toolName}`));
      }, timeout);

      this.pendingApprovals.set(approvalId, {
        toolName,
        args,
        requestedAt: Date.now(),
      });

      resolve(true);
    });
  }

  grantApproval(approvalId: string): void {
    this.pendingApprovals.delete(approvalId);
  }

  denyApproval(approvalId: string): void {
    this.pendingApprovals.delete(approvalId);
  }

  getPendingApprovals(): Array<{
    toolName: string;
    args: Record<string, unknown>;
    requestedAt: number;
    id: string;
  }> {
    return Array.from(this.pendingApprovals.entries()).map(([id, approval]) => ({
      id,
      ...approval,
    }));
  }

  clearOldApprovals(maxAge: number = 300000): void {
    const now = Date.now();
    for (const [id, approval] of this.pendingApprovals.entries()) {
      if (now - approval.requestedAt > maxAge) {
        this.pendingApprovals.delete(id);
      }
    }
  }
}

const approvalRequestInputSchema = z.object({
  tool_name: z.string(),
  args: z.record(z.string(), z.any()),
});

const approvalDecisionInputSchema = z.object({
  approval_id: z.string(),
  decision: z.enum(['approve', 'deny']),
  timeout: z.number().min(1000).max(600000).optional(),
});

class ApprovalRequestTool implements Tool {
  name = 'approval_request';
  description =
    'Request approval for a tool that requires permission. Use this tool when main agent indicates a dangerous operation requires approval.';

  inputSchema = approvalRequestInputSchema;

  validate(_input: ToolInput): boolean {
    return true;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: parsed.error.message,
            code: 'INVALID_INPUT',
          },
        };
      }

      const data = parsed.data;
      const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const timeout = 300000;
      const deadline = new Date(Date.now() + timeout);

      const toolName = data.tool_name;
      const args = data.args;

      return {
        status: 'success',
        content: `⚠️ **Approval Required**

Tool: \`${toolName}\`
Arguments: \`${JSON.stringify(args, null, 2)}\`

**Action Required**: One of:
1. Send \`approval_id: ${approvalId}\` to grant permission
2. Send \`approval_decision: ${approvalId}, approve\` to approve
3. Send \`approval_decision: ${approvalId}, deny\` to deny

**Timeout**: Approval automatically denied after 300s`,
        metadata: {
          approval_id: approvalId,
          tool_name: toolName,
          deadline: deadline.getTime(),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'An error occurred while requesting approval',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'APPROVAL_ERROR',
        },
        metadata: { duration: Date.now() - startTime },
      };
    }
  }
}

class ApprovalDecisionTool implements Tool {
  name = 'approval_decision';
  description =
    'Approve or deny a pending approval request. Use this tool to grant or deny permission for a previously requested operation.';

  inputSchema = approvalDecisionInputSchema;

  validate(_input: ToolInput): boolean {
    return true;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: parsed.error.message,
            code: 'INVALID_INPUT',
          },
        };
      }

      const data = parsed.data;
      const actionText = data.decision === 'approve' ? '✅ **Approved**' : '❌ **Denied**';
      const reasonText = data.decision === 'approve' ? 'Permission granted' : 'Permission denied';

      return {
        status: 'success',
        content: `${actionText}

${reasonText}

Approval ID: \`${data.approval_id}\``,
        metadata: {
          approval_id: data.approval_id,
          decision: data.decision,
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'An error occurred while processing approval decision',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'DECISION_ERROR',
        },
        metadata: { duration: Date.now() - startTime },
      };
    }
  }
}

export class PermissionSystem {
  manager: PermissionManager;

  constructor(config: PermissionConfig) {
    this.manager = new PermissionManager(config);
  }

  getTools(): Tool[] {
    return [new ApprovalRequestTool(), new ApprovalDecisionTool()];
  }

  checkPermission(toolName: string): PermissionLevel {
    return this.manager.checkPermission(toolName);
  }

  async requestApproval(toolName: string, args: Record<string, unknown>): Promise<boolean> {
    return this.manager.requestApproval(toolName, args);
  }

  grantApproval(approvalId: string): void {
    this.manager.grantApproval(approvalId);
  }

  denyApproval(approvalId: string): void {
    this.manager.denyApproval(approvalId);
  }

  getPendingApprovals() {
    return this.manager.getPendingApprovals();
  }

  clearOldApprovals(maxAge?: number): void {
    this.manager.clearOldApprovals(maxAge);
  }
}

export const permissionSystem = new PermissionSystem({
  toolPermission: new Map([
    ['bash', 'dangerous' as PermissionLevel],
    ['write_file', 'approval_required' as PermissionLevel],
    ['edit_file', 'approval_required' as PermissionLevel],
  ]),
  autoApprove: [],
  requireApproval: ['write_file', 'edit_file'],
  timeout: 300000,
});
