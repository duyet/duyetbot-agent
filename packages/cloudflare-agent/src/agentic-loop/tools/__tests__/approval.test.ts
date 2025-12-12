/**
 * Tests for Approval Tool
 *
 * Comprehensive tests for the approval tool including:
 * - Basic approval requests with valid parameters
 * - Input validation and error handling
 * - Risk level categorization
 * - Message formatting
 * - Approval result formatting
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { LoopContext } from '../../types.js';
import { approvalTool, createApprovalRequest, formatApprovalResult } from '../approval.js';

describe('Approval Tool', () => {
  let mockContext: LoopContext;

  beforeEach(() => {
    mockContext = {
      executionContext: {} as any,
      iteration: 0,
      toolHistory: [],
      isSubagent: false,
    };
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(approvalTool.name).toBe('request_approval');
    });

    it('should have descriptive description', () => {
      expect(approvalTool.description).toContain('approval');
      expect(approvalTool.description).toContain('sensitive');
    });

    it('should define required parameters', () => {
      expect(approvalTool.parameters.required).toContain('action');
      expect(approvalTool.parameters.required).toContain('reason');
    });

    it('should define risk_level enum', () => {
      const riskLevelProp = approvalTool.parameters.properties?.risk_level as any;
      expect(riskLevelProp.enum).toEqual(['low', 'medium', 'high', 'critical']);
    });
  });

  describe('execute - successful approval requests', () => {
    it('should request approval for valid action and reason', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Delete file /tmp/data.json',
          reason: 'Cleaning up temporary files',
        },
        mockContext
      );

      expect(result.success).toBe(false); // Approval request needs human input
      expect(result.output).toContain('🔐 Approval Required');
      expect(result.output).toContain('Delete file /tmp/data.json');
      expect(result.output).toContain('Cleaning up temporary files');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include risk level in output', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Force push to main branch',
          reason: 'Revert breaking changes',
          risk_level: 'critical',
        },
        mockContext
      );

      expect(result.output).toContain('CRITICAL');
      expect(result.output).toContain('🚨');
    });

    it('should default to medium risk level when not specified', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Modify configuration',
          reason: 'Update settings',
        },
        mockContext
      );

      expect(result.output).toContain('MEDIUM');
    });

    it('should show low risk level', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Create backup',
          reason: 'Safety precaution',
          risk_level: 'low',
        },
        mockContext
      );

      expect(result.output).toContain('LOW');
      expect(result.output).toContain('🟡');
    });

    it('should show medium risk level', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Update dependency',
          reason: 'Security patch',
          risk_level: 'medium',
        },
        mockContext
      );

      expect(result.output).toContain('MEDIUM');
      expect(result.output).toContain('🟠');
    });

    it('should show high risk level', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Drop database table',
          reason: 'Schema migration',
          risk_level: 'high',
        },
        mockContext
      );

      expect(result.output).toContain('HIGH');
      expect(result.output).toContain('🔴');
    });

    it('should return awaiting_approval status', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Delete all user data',
          reason: 'User account deletion',
          risk_level: 'critical',
        },
        mockContext
      );

      expect(result.data).toBeDefined();
      expect((result.data as any).status).toBe('awaiting_approval');
    });

    it('should include approval request ID', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Test action',
          reason: 'Testing',
        },
        mockContext
      );

      expect((result.data as any).requestId).toBeDefined();
      expect(typeof (result.data as any).requestId).toBe('string');
      expect((result.data as any).requestId).toMatch(/^approval_/);
    });

    it('should include full approval request in data', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Deploy to production',
          reason: 'Release v1.0.0',
          risk_level: 'high',
        },
        mockContext
      );

      const request = (result.data as any).request;
      expect(request.action).toBe('Deploy to production');
      expect(request.reason).toBe('Release v1.0.0');
      expect(request.riskLevel).toBe('high');
      expect(request.timestamp).toBeDefined();
      expect(request.requestId).toBeDefined();
    });

    it('should include approval prompt in output', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Some action',
          reason: 'Some reason',
        },
        mockContext
      );

      expect(result.output).toContain('approve');
      expect(result.output).toContain('reject');
    });
  });

  describe('execute - validation errors', () => {
    it('should reject empty action', async () => {
      const result = await approvalTool.execute(
        {
          action: '',
          reason: 'Some reason',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('action parameter is empty');
      expect(result.output).toContain('action');
    });

    it('should reject missing action', async () => {
      const result = await approvalTool.execute(
        {
          reason: 'Some reason',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('action parameter is empty');
    });

    it('should reject whitespace-only action', async () => {
      const result = await approvalTool.execute(
        {
          action: '   ',
          reason: 'Some reason',
        },
        mockContext
      );

      expect(result.success).toBe(false);
    });

    it('should reject empty reason', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Some action',
          reason: '',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('reason parameter is empty');
    });

    it('should reject missing reason', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Some action',
        },
        mockContext
      );

      expect(result.success).toBe(false);
    });

    it('should reject invalid risk level', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Some action',
          reason: 'Some reason',
          risk_level: 'invalid' as any,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid risk_level');
      expect(result.output).toContain('low');
      expect(result.output).toContain('medium');
      expect(result.output).toContain('high');
      expect(result.output).toContain('critical');
    });

    it('should handle undefined action gracefully', async () => {
      const result = await approvalTool.execute(
        {
          action: undefined,
          reason: 'Some reason',
        },
        mockContext
      );

      expect(result.success).toBe(false);
    });

    it('should handle undefined reason gracefully', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Some action',
          reason: undefined,
        },
        mockContext
      );

      expect(result.success).toBe(false);
    });
  });

  describe('execute - timing', () => {
    it('should measure execution duration', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Test action',
          reason: 'Test reason',
        },
        mockContext
      );

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });

    it('should have reasonable duration for valid request', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Complex action with lots of text that takes up space',
          reason: 'Complex reason with lots of text that takes up space',
        },
        mockContext
      );

      // Should be very fast (under 50ms typically)
      expect(result.durationMs).toBeLessThan(100);
    });
  });

  describe('createApprovalRequest helper', () => {
    it('should create approval request with defaults', () => {
      const request = createApprovalRequest('Delete file', 'Cleanup');

      expect(request.action).toBe('Delete file');
      expect(request.reason).toBe('Cleanup');
      expect(request.riskLevel).toBe('medium');
      expect(request.timestamp).toBeDefined();
      expect(request.requestId).toBeDefined();
    });

    it('should create approval request with custom risk level', () => {
      const request = createApprovalRequest('Delete database', 'Migration', 'critical');

      expect(request.riskLevel).toBe('critical');
    });

    it('should generate unique request IDs', () => {
      const request1 = createApprovalRequest('Action 1', 'Reason 1');
      const request2 = createApprovalRequest('Action 2', 'Reason 2');

      expect(request1.requestId).not.toBe(request2.requestId);
    });

    it('should include current timestamp', () => {
      const before = Date.now();
      const request = createApprovalRequest('Action', 'Reason');
      const after = Date.now();

      expect(request.timestamp).toBeGreaterThanOrEqual(before);
      expect(request.timestamp).toBeLessThanOrEqual(after);
    });

    it('should support all risk levels', () => {
      const levels: Array<'low' | 'medium' | 'high' | 'critical'> = [
        'low',
        'medium',
        'high',
        'critical',
      ];

      for (const level of levels) {
        const request = createApprovalRequest('Action', 'Reason', level);
        expect(request.riskLevel).toBe(level);
      }
    });
  });

  describe('formatApprovalResult helper', () => {
    it('should format approved result', () => {
      const result = formatApprovalResult(true, 'Delete file');

      expect(result).toContain('✅');
      expect(result).toContain('Approved');
      expect(result).toContain('Delete file');
    });

    it('should format rejected result', () => {
      const result = formatApprovalResult(false, 'Delete file');

      expect(result).toContain('❌');
      expect(result).toContain('Rejected');
      expect(result).toContain('Delete file');
    });

    it('should handle long action descriptions', () => {
      const longAction = 'Delete all user data and drop production database';
      const result = formatApprovalResult(true, longAction);

      expect(result).toContain(longAction);
    });

    it('should handle special characters in action', () => {
      const action = 'Delete /tmp/data_2024-01-15_backup.sql';
      const result = formatApprovalResult(true, action);

      expect(result).toContain(action);
    });
  });

  describe('integration - realistic scenarios', () => {
    it('should handle force push scenario', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Force push to main branch (HEAD~3)',
          reason: 'Revert accidental commit with sensitive data',
          risk_level: 'critical',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain('Force push');
      expect(result.output).toContain('CRITICAL');
      expect((result.data as any).status).toBe('awaiting_approval');
    });

    it('should handle deletion scenario', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Delete production user records (id > 1000)',
          reason: 'GDPR data deletion request',
          risk_level: 'high',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain('user records');
      expect(result.output).toContain('HIGH');
    });

    it('should handle backup scenario', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Create backup of production database',
          reason: 'Pre-migration safety measure',
          risk_level: 'low',
        },
        mockContext
      );

      expect(result.success).toBe(false); // Still awaiting approval (user confirms action)
      expect(result.output).toContain('backup');
      expect(result.output).toContain('LOW');
    });

    it('should format multi-line output properly', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Test action',
          reason: 'Test reason',
        },
        mockContext
      );

      const lines = result.output.split('\n');
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toContain('🔐');
    });
  });

  describe('edge cases', () => {
    it('should handle very long action descriptions', async () => {
      const longAction = 'A'.repeat(500);
      const result = await approvalTool.execute(
        {
          action: longAction,
          reason: 'Testing',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain(longAction);
    });

    it('should handle Unicode in action', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Delete file: données_importantes_🔐.txt',
          reason: 'Testing',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain('données_importantes_🔐');
    });

    it('should handle newlines in reason', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Deploy to staging',
          reason: 'Line 1\nLine 2\nLine 3',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain('Line 1');
    });

    it('should handle null risk_level gracefully', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Test action',
          reason: 'Test reason',
          risk_level: null,
        },
        mockContext
      );

      // Should default to medium, not error
      expect(result.output).toContain('MEDIUM');
    });

    it('should reject malformed risk_level types', async () => {
      const result = await approvalTool.execute(
        {
          action: 'Test action',
          reason: 'Test reason',
          risk_level: {} as any, // Object instead of string
        },
        mockContext
      );

      expect(result.success).toBe(false);
    });
  });
});
