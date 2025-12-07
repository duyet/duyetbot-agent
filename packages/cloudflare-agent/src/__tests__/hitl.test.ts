/**
 * HITL (Human-in-the-Loop) Tests
 *
 * Tests for state machine, confirmation logic, and executions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canTransitionTo,
  // State machine
  createInitialHITLState,
  createMockExecutor,
  createRegistryExecutor,
  createToolConfirmation,
  determineRiskLevel,
  executeApprovedTools,
  // Executions
  executeTool,
  executeToolsParallel,
  filterExpiredConfirmations,
  formatConfirmationRequest,
  formatExecutionResults,
  formatMultipleConfirmations,
  getApprovedConfirmations,
  getExpiredConfirmationIds,
  getPendingConfirmations,
  type HITLEvent,
  type HITLState,
  hasExpiredConfirmations,
  // Confirmation
  hasToolConfirmation,
  isAwaitingConfirmation,
  isConfirmationValid,
  parseConfirmationResponse,
  requiresConfirmation,
  type ToolExecutor,
  transitionHITLState,
} from '../hitl/index.js';
import type { ToolConfirmation } from '../routing/schemas.js';

// =============================================================================
// State Machine Tests
// =============================================================================

describe('HITL State Machine', () => {
  describe('createInitialHITLState', () => {
    it('creates initial state with idle status', () => {
      const state = createInitialHITLState('test-session');
      expect(state.status).toBe('idle');
      expect(state.sessionId).toBe('test-session');
      expect(state.pendingConfirmations).toEqual([]);
      expect(state.executionHistory).toEqual([]);
    });
  });

  describe('transitionHITLState', () => {
    let initialState: HITLState;
    let mockConfirmation: ToolConfirmation;

    beforeEach(() => {
      initialState = createInitialHITLState('test-session');
      mockConfirmation = {
        id: 'confirm_123',
        toolName: 'bash',
        toolArgs: { command: 'ls' },
        description: 'List files',
        riskLevel: 'high',
        status: 'pending',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };
    });

    it('transitions to awaiting_confirmation on REQUEST_CONFIRMATION', () => {
      const event: HITLEvent = {
        type: 'REQUEST_CONFIRMATION',
        confirmation: mockConfirmation,
      };

      const newState = transitionHITLState(initialState, event);

      expect(newState.status).toBe('awaiting_confirmation');
      expect(newState.pendingConfirmations).toHaveLength(1);
      expect(newState.pendingConfirmations[0]!.id).toBe('confirm_123');
    });

    it('transitions to executing on USER_APPROVED when no more pending', () => {
      // First add a confirmation
      let state = transitionHITLState(initialState, {
        type: 'REQUEST_CONFIRMATION',
        confirmation: mockConfirmation,
      });

      // Then approve it
      state = transitionHITLState(state, {
        type: 'USER_APPROVED',
        confirmationId: 'confirm_123',
      });

      expect(state.status).toBe('executing');
      expect(state.pendingConfirmations[0]!.status).toBe('approved');
    });

    it('stays in awaiting_confirmation if more pending after approval', () => {
      const confirmation2: ToolConfirmation = {
        ...mockConfirmation,
        id: 'confirm_456',
      };

      // Add two confirmations
      let state = transitionHITLState(initialState, {
        type: 'REQUEST_CONFIRMATION',
        confirmation: mockConfirmation,
      });
      state = transitionHITLState(state, {
        type: 'REQUEST_CONFIRMATION',
        confirmation: confirmation2,
      });

      // Approve one
      state = transitionHITLState(state, {
        type: 'USER_APPROVED',
        confirmationId: 'confirm_123',
      });

      expect(state.status).toBe('awaiting_confirmation');
    });

    it('transitions to idle on USER_REJECTED', () => {
      let state = transitionHITLState(initialState, {
        type: 'REQUEST_CONFIRMATION',
        confirmation: mockConfirmation,
      });

      state = transitionHITLState(state, {
        type: 'USER_REJECTED',
        confirmationId: 'confirm_123',
        reason: 'Too dangerous',
      });

      expect(state.status).toBe('idle');
      expect(state.pendingConfirmations[0]!.status).toBe('rejected');
      expect(state.pendingConfirmations[0]!.rejectionReason).toBe('Too dangerous');
    });

    it('handles CONFIRMATION_EXPIRED', () => {
      let state = transitionHITLState(initialState, {
        type: 'REQUEST_CONFIRMATION',
        confirmation: mockConfirmation,
      });

      state = transitionHITLState(state, {
        type: 'CONFIRMATION_EXPIRED',
        confirmationId: 'confirm_123',
      });

      expect(state.status).toBe('idle');
      expect(state.pendingConfirmations[0]!.status).toBe('expired');
    });

    it('handles EXECUTION_COMPLETED', () => {
      // Setup: Add and approve confirmation
      let state = transitionHITLState(initialState, {
        type: 'REQUEST_CONFIRMATION',
        confirmation: mockConfirmation,
      });
      state = transitionHITLState(state, {
        type: 'USER_APPROVED',
        confirmationId: 'confirm_123',
      });

      // Execute
      state = transitionHITLState(state, {
        type: 'EXECUTION_COMPLETED',
        entry: {
          toolName: 'bash',
          args: { command: 'ls' },
          result: { files: ['a.txt'] },
          success: true,
          timestamp: Date.now(),
          durationMs: 100,
        },
      });

      expect(state.status).toBe('completed');
      expect(state.executionHistory).toHaveLength(1);
    });

    it('handles EXECUTION_FAILED', () => {
      let state = transitionHITLState(initialState, {
        type: 'EXECUTION_STARTED',
        confirmationId: 'confirm_123',
      });

      state = transitionHITLState(state, {
        type: 'EXECUTION_FAILED',
        error: 'Permission denied',
      });

      expect(state.status).toBe('error');
      expect(state.errorMessage).toBe('Permission denied');
    });

    it('handles RESET', () => {
      let state = transitionHITLState(initialState, {
        type: 'REQUEST_CONFIRMATION',
        confirmation: mockConfirmation,
      });

      state = transitionHITLState(state, { type: 'RESET' });

      expect(state.status).toBe('idle');
      expect(state.pendingConfirmations).toEqual([]);
    });
  });

  describe('helper functions', () => {
    it('isAwaitingConfirmation returns true when status is awaiting_confirmation', () => {
      const state = createInitialHITLState('test');
      expect(isAwaitingConfirmation(state)).toBe(false);

      const awaitingState: HITLState = {
        ...state,
        status: 'awaiting_confirmation',
      };
      expect(isAwaitingConfirmation(awaitingState)).toBe(true);
    });

    it('getPendingConfirmations filters correctly', () => {
      const state: HITLState = {
        ...createInitialHITLState('test'),
        pendingConfirmations: [
          { id: '1', status: 'pending' } as ToolConfirmation,
          { id: '2', status: 'approved' } as ToolConfirmation,
          { id: '3', status: 'pending' } as ToolConfirmation,
        ],
      };

      const pending = getPendingConfirmations(state);
      expect(pending).toHaveLength(2);
      expect(pending.map((c) => c.id)).toEqual(['1', '3']);
    });

    it('getApprovedConfirmations filters correctly', () => {
      const state: HITLState = {
        ...createInitialHITLState('test'),
        pendingConfirmations: [
          { id: '1', status: 'pending' } as ToolConfirmation,
          { id: '2', status: 'approved' } as ToolConfirmation,
        ],
      };

      const approved = getApprovedConfirmations(state);
      expect(approved).toHaveLength(1);
      expect(approved[0]!.id).toBe('2');
    });

    it('hasExpiredConfirmations detects expired', () => {
      const now = Date.now();
      const state: HITLState = {
        ...createInitialHITLState('test'),
        pendingConfirmations: [
          {
            id: '1',
            status: 'pending',
            expiresAt: now - 1000,
          } as ToolConfirmation,
        ],
      };

      expect(hasExpiredConfirmations(state)).toBe(true);
    });

    it('getExpiredConfirmationIds returns expired IDs', () => {
      const now = Date.now();
      const state: HITLState = {
        ...createInitialHITLState('test'),
        pendingConfirmations: [
          {
            id: '1',
            status: 'pending',
            expiresAt: now - 1000,
          } as ToolConfirmation,
          {
            id: '2',
            status: 'pending',
            expiresAt: now + 10000,
          } as ToolConfirmation,
        ],
      };

      const expired = getExpiredConfirmationIds(state);
      expect(expired).toEqual(['1']);
    });

    it('canTransitionTo validates transitions', () => {
      expect(canTransitionTo('idle', 'awaiting_confirmation')).toBe(true);
      expect(canTransitionTo('idle', 'completed')).toBe(false);
      expect(canTransitionTo('awaiting_confirmation', 'executing')).toBe(true);
      expect(canTransitionTo('executing', 'completed')).toBe(true);
      expect(canTransitionTo('completed', 'idle')).toBe(true);
      expect(canTransitionTo('error', 'idle')).toBe(true);
    });
  });
});

// =============================================================================
// Confirmation Tests
// =============================================================================

describe('HITL Confirmation', () => {
  describe('hasToolConfirmation', () => {
    it('detects approval messages', () => {
      expect(hasToolConfirmation('yes')).toBe(true);
      expect(hasToolConfirmation('Yes')).toBe(true);
      expect(hasToolConfirmation('YES')).toBe(true);
      expect(hasToolConfirmation('y')).toBe(true);
      expect(hasToolConfirmation('ok')).toBe(true);
      expect(hasToolConfirmation('okay')).toBe(true);
      expect(hasToolConfirmation('approve')).toBe(true);
      expect(hasToolConfirmation('confirm')).toBe(true);
      expect(hasToolConfirmation('go')).toBe(true);
      expect(hasToolConfirmation('go ahead')).toBe(true);
      expect(hasToolConfirmation('proceed')).toBe(true);
      expect(hasToolConfirmation('✅')).toBe(true);
      expect(hasToolConfirmation('👍')).toBe(true);
    });

    it('detects rejection messages', () => {
      expect(hasToolConfirmation('no')).toBe(true);
      expect(hasToolConfirmation('No')).toBe(true);
      expect(hasToolConfirmation('n')).toBe(true);
      expect(hasToolConfirmation('cancel')).toBe(true);
      expect(hasToolConfirmation('reject')).toBe(true);
      expect(hasToolConfirmation('stop')).toBe(true);
      expect(hasToolConfirmation('abort')).toBe(true);
      expect(hasToolConfirmation('nope')).toBe(true);
      expect(hasToolConfirmation('❌')).toBe(true);
      expect(hasToolConfirmation('👎')).toBe(true);
    });

    it('returns false for non-confirmation messages', () => {
      expect(hasToolConfirmation('hello')).toBe(false);
      expect(hasToolConfirmation('what is this?')).toBe(false);
      expect(hasToolConfirmation('tell me more')).toBe(false);
    });
  });

  describe('parseConfirmationResponse', () => {
    it('parses approval responses', () => {
      const result = parseConfirmationResponse('yes');
      expect(result.isConfirmation).toBe(true);
      expect(result.action).toBe('approve');
    });

    it('parses rejection responses', () => {
      const result = parseConfirmationResponse('no');
      expect(result.isConfirmation).toBe(true);
      expect(result.action).toBe('reject');
    });

    it('handles rejection without reason', () => {
      const result = parseConfirmationResponse('no');
      expect(result.isConfirmation).toBe(true);
      expect(result.action).toBe('reject');
      expect(result.reason).toBeUndefined();
    });

    it('parses specific confirmation ID', () => {
      const result = parseConfirmationResponse('approve confirm_123');
      expect(result.isConfirmation).toBe(true);
      expect(result.action).toBe('approve');
      expect(result.targetConfirmationId).toBe('confirm_123');
    });

    it('returns none for non-confirmation', () => {
      const result = parseConfirmationResponse('hello');
      expect(result.isConfirmation).toBe(false);
      expect(result.action).toBe('none');
    });
  });

  describe('determineRiskLevel', () => {
    it('returns high for dangerous tools', () => {
      expect(determineRiskLevel('bash')).toBe('high');
      expect(determineRiskLevel('shell')).toBe('high');
      expect(determineRiskLevel('delete')).toBe('high');
      expect(determineRiskLevel('remove')).toBe('high');
      expect(determineRiskLevel('deploy')).toBe('high');
    });

    it('returns high for dangerous args', () => {
      expect(determineRiskLevel('custom', { action: 'delete' })).toBe('high');
      expect(determineRiskLevel('custom', { force: '--force' })).toBe('high');
    });

    it('returns medium for write operations', () => {
      expect(determineRiskLevel('custom', { action: 'write' })).toBe('medium');
      expect(determineRiskLevel('custom', { action: 'update' })).toBe('medium');
    });

    it('returns low for read operations', () => {
      expect(determineRiskLevel('read')).toBe('low');
      expect(determineRiskLevel('get')).toBe('low');
      expect(determineRiskLevel('list')).toBe('low');
      expect(determineRiskLevel('search')).toBe('low');
    });
  });

  describe('requiresConfirmation', () => {
    it('returns true for high risk tools with high threshold', () => {
      expect(requiresConfirmation('bash', {}, 'high')).toBe(true);
    });

    it('returns false for low risk tools with high threshold', () => {
      expect(requiresConfirmation('read', {}, 'high')).toBe(false);
    });

    it('returns true for medium risk with medium threshold', () => {
      expect(requiresConfirmation('custom', { action: 'update' }, 'medium')).toBe(true);
    });
  });

  describe('createToolConfirmation', () => {
    it('creates a valid confirmation', () => {
      const confirmation = createToolConfirmation('bash', { command: 'ls' }, 'List files');

      expect(confirmation.toolName).toBe('bash');
      expect(confirmation.toolArgs).toEqual({ command: 'ls' });
      expect(confirmation.description).toBe('List files');
      expect(confirmation.status).toBe('pending');
      expect(confirmation.riskLevel).toBe('high');
      expect(confirmation.id).toMatch(/^confirm_/);
      expect(confirmation.expiresAt).toBeGreaterThan(Date.now());
    });

    it('uses custom expiry time', () => {
      const now = Date.now();
      const confirmation = createToolConfirmation('read', {}, 'Read file', 60000);

      expect(confirmation.expiresAt).toBeGreaterThan(now + 59000);
      expect(confirmation.expiresAt).toBeLessThan(now + 61000);
    });
  });

  describe('formatConfirmationRequest', () => {
    it('formats high risk confirmation', () => {
      const confirmation: ToolConfirmation = {
        id: 'confirm_123',
        toolName: 'bash',
        toolArgs: { command: 'rm -rf /' },
        description: 'Delete all files',
        riskLevel: 'high',
        status: 'pending',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };

      const formatted = formatConfirmationRequest(confirmation);

      expect(formatted).toContain('🔴');
      expect(formatted).toContain('bash');
      expect(formatted).toContain('high');
      expect(formatted).toContain('Delete all files');
      expect(formatted).toContain('yes');
      expect(formatted).toContain('no');
    });

    it('formats medium risk confirmation', () => {
      const confirmation: ToolConfirmation = {
        id: 'confirm_123',
        toolName: 'write',
        toolArgs: { file: 'test.txt' },
        description: 'Write file',
        riskLevel: 'medium',
        status: 'pending',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };

      const formatted = formatConfirmationRequest(confirmation);

      expect(formatted).toContain('🟡');
    });
  });

  describe('formatMultipleConfirmations', () => {
    it('handles empty list', () => {
      expect(formatMultipleConfirmations([])).toBe('No pending confirmations.');
    });

    it('formats single confirmation', () => {
      const confirmations: ToolConfirmation[] = [
        {
          id: 'confirm_123',
          toolName: 'bash',
          toolArgs: {},
          description: 'Test',
          riskLevel: 'high',
          status: 'pending',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
      ];

      const formatted = formatMultipleConfirmations(confirmations);
      expect(formatted).toContain('bash');
    });

    it('formats multiple confirmations', () => {
      const confirmations: ToolConfirmation[] = [
        {
          id: 'confirm_1',
          toolName: 'bash',
          toolArgs: {},
          description: 'Test 1',
          riskLevel: 'high',
          status: 'pending',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        {
          id: 'confirm_2',
          toolName: 'write',
          toolArgs: {},
          description: 'Test 2',
          riskLevel: 'medium',
          status: 'pending',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
      ];

      const formatted = formatMultipleConfirmations(confirmations);
      expect(formatted).toContain('2 Confirmations Required');
      expect(formatted).toContain('approve 1');
      expect(formatted).toContain('reject 2');
    });
  });

  describe('isConfirmationValid', () => {
    it('returns true for valid pending confirmation', () => {
      const confirmation: ToolConfirmation = {
        id: 'confirm_123',
        toolName: 'bash',
        toolArgs: {},
        description: 'Test',
        riskLevel: 'high',
        status: 'pending',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };

      expect(isConfirmationValid(confirmation)).toBe(true);
    });

    it('returns false for expired confirmation', () => {
      const confirmation: ToolConfirmation = {
        id: 'confirm_123',
        toolName: 'bash',
        toolArgs: {},
        description: 'Test',
        riskLevel: 'high',
        status: 'pending',
        requestedAt: Date.now() - 400000,
        expiresAt: Date.now() - 100000,
      };

      expect(isConfirmationValid(confirmation)).toBe(false);
    });

    it('returns false for non-pending confirmation', () => {
      const confirmation: ToolConfirmation = {
        id: 'confirm_123',
        toolName: 'bash',
        toolArgs: {},
        description: 'Test',
        riskLevel: 'high',
        status: 'approved',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };

      expect(isConfirmationValid(confirmation)).toBe(false);
    });
  });

  describe('filterExpiredConfirmations', () => {
    it('filters out expired pending confirmations', () => {
      const now = Date.now();
      const confirmations: ToolConfirmation[] = [
        {
          id: '1',
          toolName: 'bash',
          toolArgs: {},
          description: 'Test',
          riskLevel: 'high',
          status: 'pending',
          requestedAt: now,
          expiresAt: now - 1000, // Expired
        },
        {
          id: '2',
          toolName: 'read',
          toolArgs: {},
          description: 'Test',
          riskLevel: 'low',
          status: 'pending',
          requestedAt: now,
          expiresAt: now + 300000, // Valid
        },
        {
          id: '3',
          toolName: 'write',
          toolArgs: {},
          description: 'Test',
          riskLevel: 'medium',
          status: 'approved', // Not pending, so kept regardless of expiry
          requestedAt: now,
          expiresAt: now - 1000,
        },
      ];

      const filtered = filterExpiredConfirmations(confirmations);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((c) => c.id)).toEqual(['2', '3']);
    });
  });
});

// =============================================================================
// Executions Tests
// =============================================================================

describe('HITL Executions', () => {
  describe('executeTool', () => {
    it('executes tool successfully', async () => {
      const executor: ToolExecutor = vi.fn().mockResolvedValue({ result: 'success' });

      const confirmation: ToolConfirmation = {
        id: 'confirm_123',
        toolName: 'bash',
        toolArgs: { command: 'ls' },
        description: 'List files',
        riskLevel: 'high',
        status: 'approved',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };

      const result = await executeTool(confirmation, executor);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('bash');
      expect(result.result).toEqual({ result: 'success' });
      expect(executor).toHaveBeenCalledWith('bash', { command: 'ls' });
    });

    it('handles tool failure', async () => {
      const executor: ToolExecutor = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const confirmation: ToolConfirmation = {
        id: 'confirm_123',
        toolName: 'bash',
        toolArgs: { command: 'ls' },
        description: 'List files',
        riskLevel: 'high',
        status: 'approved',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };

      const result = await executeTool(confirmation, executor);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('handles timeout', async () => {
      const executor: ToolExecutor = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5000)));

      const confirmation: ToolConfirmation = {
        id: 'confirm_123',
        toolName: 'bash',
        toolArgs: { command: 'sleep 10' },
        description: 'Sleep',
        riskLevel: 'high',
        status: 'approved',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };

      const result = await executeTool(confirmation, executor, {
        timeoutMs: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool execution timed out');
    });

    it('retries on failure', async () => {
      let attempts = 0;
      const executor: ToolExecutor = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { result: 'success' };
      });

      const confirmation: ToolConfirmation = {
        id: 'confirm_123',
        toolName: 'bash',
        toolArgs: {},
        description: 'Test',
        riskLevel: 'high',
        status: 'approved',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 300000,
      };

      const result = await executeTool(confirmation, executor, {
        maxRetries: 3,
        retryDelayMs: 10,
      });

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });
  });

  describe('executeApprovedTools', () => {
    it('executes multiple tools in sequence', async () => {
      const executor: ToolExecutor = vi.fn().mockResolvedValue({ result: 'success' });

      const confirmations: ToolConfirmation[] = [
        {
          id: '1',
          toolName: 'tool1',
          toolArgs: {},
          description: 'Test 1',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        {
          id: '2',
          toolName: 'tool2',
          toolArgs: {},
          description: 'Test 2',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
      ];

      const result = await executeApprovedTools(confirmations, executor);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.allSucceeded).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('filters non-approved confirmations', async () => {
      const executor: ToolExecutor = vi.fn().mockResolvedValue({ result: 'success' });

      const confirmations: ToolConfirmation[] = [
        {
          id: '1',
          toolName: 'tool1',
          toolArgs: {},
          description: 'Test 1',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        {
          id: '2',
          toolName: 'tool2',
          toolArgs: {},
          description: 'Test 2',
          riskLevel: 'low',
          status: 'pending', // Not approved
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
      ];

      const result = await executeApprovedTools(confirmations, executor);

      expect(result.results).toHaveLength(1);
      expect(executor).toHaveBeenCalledTimes(1);
    });

    it('continues on error by default', async () => {
      let callCount = 0;
      const executor: ToolExecutor = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First fails');
        }
        return { result: 'success' };
      });

      const confirmations: ToolConfirmation[] = [
        {
          id: '1',
          toolName: 'tool1',
          toolArgs: {},
          description: 'Test 1',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        {
          id: '2',
          toolName: 'tool2',
          toolArgs: {},
          description: 'Test 2',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
      ];

      const result = await executeApprovedTools(confirmations, executor);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.allSucceeded).toBe(false);
    });

    it('stops on error when configured', async () => {
      const executor: ToolExecutor = vi
        .fn()
        .mockRejectedValueOnce(new Error('First fails'))
        .mockResolvedValue({ result: 'success' });

      const confirmations: ToolConfirmation[] = [
        {
          id: '1',
          toolName: 'tool1',
          toolArgs: {},
          description: 'Test 1',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        {
          id: '2',
          toolName: 'tool2',
          toolArgs: {},
          description: 'Test 2',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
      ];

      const result = await executeApprovedTools(confirmations, executor, {
        continueOnError: false,
      });

      expect(result.results).toHaveLength(1);
      expect(executor).toHaveBeenCalledTimes(1);
    });

    it('calls progress callback', async () => {
      const executor: ToolExecutor = vi.fn().mockResolvedValue({ result: 'success' });
      const onProgress = vi.fn();

      const confirmations: ToolConfirmation[] = [
        {
          id: '1',
          toolName: 'tool1',
          toolArgs: {},
          description: 'Test 1',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
      ];

      await executeApprovedTools(confirmations, executor, {}, onProgress);

      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenCalledWith(expect.any(Object), 0, 1);
    });
  });

  describe('executeToolsParallel', () => {
    it('executes tools in parallel batches', async () => {
      const executionOrder: string[] = [];
      const executor: ToolExecutor = vi.fn().mockImplementation(async (toolName: string) => {
        executionOrder.push(toolName);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { result: 'success' };
      });

      const confirmations: ToolConfirmation[] = [
        {
          id: '1',
          toolName: 'tool1',
          toolArgs: {},
          description: 'Test 1',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        {
          id: '2',
          toolName: 'tool2',
          toolArgs: {},
          description: 'Test 2',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        {
          id: '3',
          toolName: 'tool3',
          toolArgs: {},
          description: 'Test 3',
          riskLevel: 'low',
          status: 'approved',
          requestedAt: Date.now(),
          expiresAt: Date.now() + 300000,
        },
      ];

      const result = await executeToolsParallel(confirmations, executor, {
        maxConcurrency: 2,
      });

      expect(result.successCount).toBe(3);
      expect(result.allSucceeded).toBe(true);
    });
  });

  describe('formatExecutionResults', () => {
    it('formats successful results', () => {
      const result = {
        results: [
          {
            toolName: 'tool1',
            args: {},
            result: 'success',
            success: true,
            timestamp: Date.now(),
            durationMs: 100,
          },
        ],
        successCount: 1,
        failureCount: 0,
        totalDurationMs: 100,
        allSucceeded: true,
      };

      const formatted = formatExecutionResults(result);

      expect(formatted).toContain('[ok]');
      expect(formatted).toContain('tool1');
      expect(formatted).toContain('100ms');
    });

    it('formats mixed results', () => {
      const result = {
        results: [
          {
            toolName: 'tool1',
            args: {},
            result: 'success',
            success: true,
            timestamp: Date.now(),
            durationMs: 100,
          },
          {
            toolName: 'tool2',
            args: {},
            result: null,
            success: false,
            error: 'Permission denied',
            timestamp: Date.now(),
            durationMs: 50,
          },
        ],
        successCount: 1,
        failureCount: 1,
        totalDurationMs: 150,
        allSucceeded: false,
      };

      const formatted = formatExecutionResults(result);

      expect(formatted).toContain('1 error');
      expect(formatted).toContain('Permission denied');
    });
  });

  describe('createMockExecutor', () => {
    it('returns default success for unknown tools', async () => {
      const executor = createMockExecutor();
      const result = await executor('unknown', {});

      expect(result).toEqual({ success: true, toolName: 'unknown' });
    });

    it('returns configured results', async () => {
      const results = new Map<string, unknown>([['myTool', { custom: 'result' }]]);
      const executor = createMockExecutor(results);

      const result = await executor('myTool', {});

      expect(result).toEqual({ custom: 'result' });
    });
  });

  describe('createRegistryExecutor', () => {
    it('executes registered tools', async () => {
      const registry = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
      registry.set('myTool', async (args) => ({ processed: args }));

      const executor = createRegistryExecutor(registry);
      const result = await executor('myTool', { input: 'test' });

      expect(result).toEqual({ processed: { input: 'test' } });
    });

    it('throws for unregistered tools', async () => {
      const registry = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
      const executor = createRegistryExecutor(registry);

      await expect(executor('unknown', {})).rejects.toThrow('Tool not found: unknown');
    });
  });
});
