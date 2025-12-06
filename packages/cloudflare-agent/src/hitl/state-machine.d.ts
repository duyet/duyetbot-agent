/**
 * HITL State Machine
 *
 * Finite state machine for Human-in-the-Loop workflow management.
 * Tracks pending tool confirmations and execution state.
 */
import type { ToolConfirmation } from '../routing/schemas.js';
/**
 * HITL workflow status
 */
export type HITLStatus = 'idle' | 'awaiting_confirmation' | 'executing' | 'completed' | 'error';
/**
 * Execution history entry
 */
export interface ExecutionEntry {
  /** Tool that was executed */
  toolName: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** Result from execution */
  result: unknown;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Execution timestamp */
  timestamp: number;
  /** Duration in ms */
  durationMs: number;
}
/**
 * HITL state machine state
 */
export interface HITLState {
  /** Current status */
  status: HITLStatus;
  /** Tool confirmations awaiting user response */
  pendingConfirmations: ToolConfirmation[];
  /** History of tool executions */
  executionHistory: ExecutionEntry[];
  /** Session identifier (populated lazily from context) */
  sessionId?: string;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Error message if in error state */
  errorMessage?: string;
}
/**
 * State machine events
 */
export type HITLEvent =
  | {
      type: 'REQUEST_CONFIRMATION';
      confirmation: ToolConfirmation;
    }
  | {
      type: 'USER_APPROVED';
      confirmationId: string;
    }
  | {
      type: 'USER_REJECTED';
      confirmationId: string;
      reason?: string;
    }
  | {
      type: 'CONFIRMATION_EXPIRED';
      confirmationId: string;
    }
  | {
      type: 'EXECUTION_STARTED';
      confirmationId: string;
    }
  | {
      type: 'EXECUTION_COMPLETED';
      entry: ExecutionEntry;
    }
  | {
      type: 'EXECUTION_FAILED';
      error: string;
    }
  | {
      type: 'RESET';
    };
/**
 * Create initial HITL state
 */
export declare function createInitialHITLState(sessionId?: string): HITLState;
/**
 * Transition the state machine to a new state based on an event
 */
export declare function transitionHITLState(state: HITLState, event: HITLEvent): HITLState;
/**
 * Check if the state machine is waiting for user input
 */
export declare function isAwaitingConfirmation(state: HITLState): boolean;
/**
 * Get all pending confirmations
 */
export declare function getPendingConfirmations(state: HITLState): ToolConfirmation[];
/**
 * Get all approved confirmations ready for execution
 */
export declare function getApprovedConfirmations(state: HITLState): ToolConfirmation[];
/**
 * Check if there are expired confirmations
 */
export declare function hasExpiredConfirmations(state: HITLState): boolean;
/**
 * Get expired confirmation IDs
 */
export declare function getExpiredConfirmationIds(state: HITLState): string[];
/**
 * Can transition to a given status
 */
export declare function canTransitionTo(
  currentStatus: HITLStatus,
  targetStatus: HITLStatus
): boolean;
//# sourceMappingURL=state-machine.d.ts.map
