/**
 * HITL State Machine
 *
 * Finite state machine for Human-in-the-Loop workflow management.
 * Tracks pending tool confirmations and execution state.
 */
/**
 * Create initial HITL state
 */
export function createInitialHITLState(sessionId) {
  const state = {
    status: 'idle',
    pendingConfirmations: [],
    executionHistory: [],
    lastActivityAt: Date.now(),
  };
  if (sessionId) {
    state.sessionId = sessionId;
  }
  return state;
}
/**
 * Transition the state machine to a new state based on an event
 */
export function transitionHITLState(state, event) {
  const now = Date.now();
  switch (event.type) {
    case 'REQUEST_CONFIRMATION': {
      return {
        ...state,
        status: 'awaiting_confirmation',
        pendingConfirmations: [...state.pendingConfirmations, event.confirmation],
        lastActivityAt: now,
      };
    }
    case 'USER_APPROVED': {
      const confirmation = state.pendingConfirmations.find((c) => c.id === event.confirmationId);
      if (!confirmation) {
        return state;
      }
      const updatedConfirmations = state.pendingConfirmations.map((c) =>
        c.id === event.confirmationId ? { ...c, status: 'approved', respondedAt: now } : c
      );
      // Check if there are still pending confirmations
      const hasPending = updatedConfirmations.some((c) => c.status === 'pending');
      return {
        ...state,
        status: hasPending ? 'awaiting_confirmation' : 'executing',
        pendingConfirmations: updatedConfirmations,
        lastActivityAt: now,
      };
    }
    case 'USER_REJECTED': {
      const confirmation = state.pendingConfirmations.find((c) => c.id === event.confirmationId);
      if (!confirmation) {
        return state;
      }
      const updatedConfirmations = state.pendingConfirmations.map((c) =>
        c.id === event.confirmationId
          ? {
              ...c,
              status: 'rejected',
              respondedAt: now,
              rejectionReason: event.reason,
            }
          : c
      );
      // Check if there are still pending confirmations
      const hasPending = updatedConfirmations.some((c) => c.status === 'pending');
      return {
        ...state,
        status: hasPending ? 'awaiting_confirmation' : 'idle',
        pendingConfirmations: updatedConfirmations,
        lastActivityAt: now,
      };
    }
    case 'CONFIRMATION_EXPIRED': {
      const updatedConfirmations = state.pendingConfirmations.map((c) =>
        c.id === event.confirmationId ? { ...c, status: 'expired' } : c
      );
      const hasPending = updatedConfirmations.some((c) => c.status === 'pending');
      return {
        ...state,
        status: hasPending ? 'awaiting_confirmation' : 'idle',
        pendingConfirmations: updatedConfirmations,
        lastActivityAt: now,
      };
    }
    case 'EXECUTION_STARTED': {
      return {
        ...state,
        status: 'executing',
        lastActivityAt: now,
      };
    }
    case 'EXECUTION_COMPLETED': {
      // Remove executed confirmation from pending
      const executedConfirmation = state.pendingConfirmations.find(
        (c) => c.toolName === event.entry.toolName && c.status === 'approved'
      );
      const updatedConfirmations = executedConfirmation
        ? state.pendingConfirmations.filter((c) => c.id !== executedConfirmation.id)
        : state.pendingConfirmations;
      const hasMoreApproved = updatedConfirmations.some((c) => c.status === 'approved');
      const hasPending = updatedConfirmations.some((c) => c.status === 'pending');
      return {
        ...state,
        status: hasMoreApproved ? 'executing' : hasPending ? 'awaiting_confirmation' : 'completed',
        pendingConfirmations: updatedConfirmations,
        executionHistory: [...state.executionHistory, event.entry],
        lastActivityAt: now,
      };
    }
    case 'EXECUTION_FAILED': {
      return {
        ...state,
        status: 'error',
        errorMessage: event.error,
        lastActivityAt: now,
      };
    }
    case 'RESET': {
      return createInitialHITLState(state.sessionId);
    }
    default:
      return state;
  }
}
/**
 * Check if the state machine is waiting for user input
 */
export function isAwaitingConfirmation(state) {
  return state.status === 'awaiting_confirmation';
}
/**
 * Get all pending confirmations
 */
export function getPendingConfirmations(state) {
  return state.pendingConfirmations.filter((c) => c.status === 'pending');
}
/**
 * Get all approved confirmations ready for execution
 */
export function getApprovedConfirmations(state) {
  return state.pendingConfirmations.filter((c) => c.status === 'approved');
}
/**
 * Check if there are expired confirmations
 */
export function hasExpiredConfirmations(state) {
  const now = Date.now();
  return state.pendingConfirmations.some((c) => c.status === 'pending' && c.expiresAt < now);
}
/**
 * Get expired confirmation IDs
 */
export function getExpiredConfirmationIds(state) {
  const now = Date.now();
  return state.pendingConfirmations
    .filter((c) => c.status === 'pending' && c.expiresAt < now)
    .map((c) => c.id);
}
/**
 * Can transition to a given status
 */
export function canTransitionTo(currentStatus, targetStatus) {
  const validTransitions = {
    idle: ['awaiting_confirmation', 'executing'],
    awaiting_confirmation: ['executing', 'idle', 'error'],
    executing: ['completed', 'error', 'awaiting_confirmation', 'idle'],
    completed: ['idle'],
    error: ['idle'],
  };
  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}
