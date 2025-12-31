/**
 * Hook for optimistic UI updates with automatic rollback on error.
 *
 * Features:
 * - Optimistic message appending
 * - Automatic rollback on API failure
 * - Pending operation state tracking
 * - Error recovery with retry
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

/**
 * Result of a mutation operation
 */
export interface MutationResult<T = void> {
	success: boolean;
	error?: string;
	data?: T;
}

/**
 * Pending operation state
 */
export interface PendingOperation {
	id: string;
	type: "append" | "update" | "delete" | "regenerate";
	optimisticData: ChatMessage | ChatMessage[] | string;
	rollbackData: () => void;
	timestamp: number;
}

/**
 * Configuration for optimistic updates
 */
interface OptimisticUpdateConfig {
	/** Delay before rollback (ms) - allows time for error display */
	rollbackDelay?: number;
	/** Whether to show error toasts on failure */
	showErrorToast?: boolean;
	/** Custom toast function */
	onError?: (error: string) => void;
}

/**
 * Hook state
 */
// interface OptimisticUpdateState {
// 	pendingOperations: PendingOperation[];
// 	hasPendingOperation: boolean;
// 	currentOperationId: string | null;
// }

/**
 * Hook for optimistic UI updates with automatic rollback
 *
 * @example
 * ```tsx
 * const { withOptimisticUpdate } = useOptimisticUpdate({
 *   messages,
 *   setMessages,
 *   rollbackDelay: 2000,
 *   showErrorToast: true,
 * });
 *
 * // Optimistic append with rollback
 * const handleDelete = async (messageId: string) => {
 *   await withOptimisticUpdate({
 *     type: "delete",
 *     optimisticData: messageId,
 *     applyOptimistic: (id) => {
 *       setMessages(prev => prev.filter(m => m.id !== id));
 *     },
 *     execute: async () => {
 *       await deleteMessage({ id: messageId });
 *     },
 *     rollback: () => {
 *       // Messages will be restored to previous state
 *     },
 *   });
 * };
 * ```
 */
export function useOptimisticUpdate(
	messages: ChatMessage[],
	setMessages: (
		messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
	) => void,
	config: OptimisticUpdateConfig = {},
) {
	const { rollbackDelay = 2000, showErrorToast = true } = config;

	const [pendingOperations, setPendingOperations] = useState<
		PendingOperation[]
	>([]);
	const [currentOperationId, setCurrentOperationId] = useState<string | null>(
		null,
	);
	const rollbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const messagesSnapshotRef = useRef<ChatMessage[]>(messages);

	// Keep snapshot updated when messages change (and no pending operations)
	const hasPendingOperation = pendingOperations.length > 0;

	// Update snapshot when messages change and no operations are pending
	if (!hasPendingOperation) {
		messagesSnapshotRef.current = messages;
	}

	/**
	 * Clear any pending rollback timeout
	 */
	const clearRollbackTimeout = useCallback(() => {
		if (rollbackTimeoutRef.current) {
			clearTimeout(rollbackTimeoutRef.current);
			rollbackTimeoutRef.current = undefined;
		}
	}, []);

	/**
	 * Perform optimistic update with automatic rollback
	 */
	const withOptimisticUpdate = useCallback(
		async <T = void>(options: {
			type: PendingOperation["type"];
			optimisticData: ChatMessage | ChatMessage[] | string;
			applyOptimistic: (data: typeof options.optimisticData) => void;
			execute: () => Promise<MutationResult<T>>;
			rollback?: (error?: string) => void;
		}): Promise<MutationResult<T>> => {
			const operationId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
			const timestamp = Date.now();
			const snapshot = [...messagesSnapshotRef.current];

			const newOperation: PendingOperation = {
				id: operationId,
				type: options.type,
				optimisticData: options.optimisticData,
				rollbackData: () => {
					setMessages(snapshot);
				},
				timestamp,
			};

			// Apply optimistic update immediately
			try {
				options.applyOptimistic(options.optimisticData);
			} catch (error) {
				console.error(
					"[OptimisticUpdate] Failed to apply optimistic update:",
					error,
				);
				return { success: false, error: "Failed to apply optimistic update" };
			}

			// Track operation
			setPendingOperations((prev) => [...prev, newOperation]);
			setCurrentOperationId(operationId);

			// Clear any existing rollback timeout
			clearRollbackTimeout();

			try {
				// Execute the actual mutation
				const result = await options.execute();

				if (result.success) {
					// Success - clear this operation
					setPendingOperations((prev) =>
						prev.filter((op) => op.id !== operationId),
					);
					setCurrentOperationId(null);
					return result;
				}

				// Mutation failed - schedule rollback
				const errorMessage = result.error || "Operation failed";

				if (showErrorToast) {
					// Use toast function from components/toast
					console.error("[OptimisticUpdate] Operation failed:", errorMessage);
				}

				// Schedule rollback
				rollbackTimeoutRef.current = setTimeout(() => {
					newOperation.rollbackData();
					options.rollback?.(errorMessage);
					setPendingOperations((prev) =>
						prev.filter((op) => op.id !== operationId),
					);
					setCurrentOperationId(null);
				}, rollbackDelay);

				return result;
			} catch (error) {
				// Exception thrown - schedule rollback
				const errorMessage =
					error instanceof Error
						? error.message
						: "An unexpected error occurred";

				console.error("[OptimisticUpdate] Mutation threw error:", error);

				// Schedule rollback
				rollbackTimeoutRef.current = setTimeout(() => {
					newOperation.rollbackData();
					options.rollback?.(errorMessage);
					setPendingOperations((prev) =>
						prev.filter((op) => op.id !== operationId),
					);
					setCurrentOperationId(null);
				}, rollbackDelay);

				return { success: false, error: errorMessage };
			}
		},
		[setMessages, rollbackDelay, showErrorToast, clearRollbackTimeout],
	);

	/**
	 * Optimistic message append
	 */
	const optimisticAppend = useCallback(
		async (message: ChatMessage, execute: () => Promise<MutationResult>) => {
			return withOptimisticUpdate({
				type: "append",
				optimisticData: message,
				applyOptimistic: (msg) => {
					setMessages((prev) => [...prev, msg as ChatMessage]);
				},
				execute,
			});
		},
		[setMessages, withOptimisticUpdate],
	);

	/**
	 * Optimistic message update
	 */
	const optimisticUpdate = useCallback(
		async (
			messageId: string,
			updates: Partial<ChatMessage>,
			execute: () => Promise<MutationResult>,
		) => {
			return withOptimisticUpdate({
				type: "update",
				optimisticData: messageId,
				applyOptimistic: (id) => {
					setMessages((prev) =>
						prev.map((m) =>
							m.id === (id as string) ? { ...m, ...updates } : m,
						),
					);
				},
				execute,
			});
		},
		[setMessages, withOptimisticUpdate],
	);

	/**
	 * Optimistic message delete
	 */
	const optimisticDelete = useCallback(
		async (messageId: string, execute: () => Promise<MutationResult>) => {
			return withOptimisticUpdate({
				type: "delete",
				optimisticData: messageId,
				applyOptimistic: (id) => {
					setMessages((prev) => prev.filter((m) => m.id !== (id as string)));
				},
				execute,
			});
		},
		[setMessages, withOptimisticUpdate],
	);

	/**
	 * Optimistic message regeneration
	 */
	const optimisticRegenerate = useCallback(
		async (messageId: string, execute: () => Promise<MutationResult>) => {
			return withOptimisticUpdate({
				type: "regenerate",
				optimisticData: messageId,
				applyOptimistic: (id) => {
					// Mark message as regenerating
					setMessages((prev) =>
						prev.map((m) =>
							m.id === (id as string)
								? {
										...m,
										parts: [{ type: "text" as const, text: "Regenerating..." }],
									}
								: m,
						),
					);
				},
				execute,
			});
		},
		[setMessages, withOptimisticUpdate],
	);

	/**
	 * Cancel pending rollback
	 */
	const cancelRollback = useCallback(() => {
		clearRollbackTimeout();
		setPendingOperations([]);
		setCurrentOperationId(null);
	}, [clearRollbackTimeout]);

	/**
	 * Force immediate rollback
	 */
	const forceRollback = useCallback(() => {
		clearRollbackTimeout();
		// Rollback all pending operations
		void pendingOperations.forEach((op) => {
			op.rollbackData();
		});
		setPendingOperations([]);
		setCurrentOperationId(null);
	}, [clearRollbackTimeout, pendingOperations]);

	// Cleanup on unmount (only in development for debugging)
	useEffect(() => {
		if (process.env.NODE_ENV !== "production") {
			return () => {
				clearRollbackTimeout();
			};
		}
		return undefined;
	}, [clearRollbackTimeout]);

	return {
		// State
		pendingOperations,
		hasPendingOperation,
		currentOperationId,

		// Core operations
		withOptimisticUpdate,
		optimisticAppend,
		optimisticUpdate,
		optimisticDelete,
		optimisticRegenerate,

		// Rollback control
		cancelRollback,
		forceRollback,
	};
}
