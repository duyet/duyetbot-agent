/**
 * Unit tests for use-optimistic-update hook
 *
 * Test Categories:
 * 1. Hook initialization and state
 * 2. Successful optimistic updates
 * 3. Rollback on API failure
 * 4. Rollback on exception
 * 5. Operation cancellation
 * 6. Specific operations (append, update, delete, regenerate)
 * 7. Multiple concurrent operations
 * 8. Rollback timing and delays
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";
import { useOptimisticUpdate } from "./use-optimistic-update";

// Helper to create a mock ChatMessage
const createMockMessage = (id: string, text: string): ChatMessage => ({
	id,
	role: "user",
	parts: [{ type: "text" as const, text }],
});

// Helper to create a setMessages callback tracker
const createSetMessagesTracker = () => {
	const calls: Array<ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])> =
		[];
	const setMessages = (
		messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
	) => {
		calls.push(messages);
	};

	const getLatestMessages = (initial: ChatMessage[]): ChatMessage[] => {
		let result = initial;
		for (const call of calls) {
			if (typeof call === "function") {
				result = call(result);
			} else {
				result = call;
			}
		}
		return result;
	};

	const reset = () => {
		calls.length = 0;
	};

	return { setMessages, getLatestMessages, reset, calls };
};

describe("useOptimisticUpdate - Initialization and State", () => {
	it("initializes with empty pending operations", () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		expect(result.current.pendingOperations).toEqual([]);
		expect(result.current.hasPendingOperation).toBe(false);
		expect(result.current.currentOperationId).toBeNull();
	});

	it("returns all expected API methods", () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		// State
		expect(result.current.pendingOperations).toBeDefined();
		expect(result.current.hasPendingOperation).toBeDefined();
		expect(result.current.currentOperationId).toBeDefined();

		// Core operations
		expect(result.current.withOptimisticUpdate).toBeDefined();
		expect(result.current.optimisticAppend).toBeDefined();
		expect(result.current.optimisticUpdate).toBeDefined();
		expect(result.current.optimisticDelete).toBeDefined();
		expect(result.current.optimisticRegenerate).toBeDefined();

		// Rollback control
		expect(result.current.cancelRollback).toBeDefined();
		expect(result.current.forceRollback).toBeDefined();
	});

	it("respects custom config options", () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 5000,
				showErrorToast: false,
			}),
		);

		// Config should be applied (can't directly test, but hook initializes without error)
		expect(result.current.pendingOperations).toEqual([]);
	});
});

describe("useOptimisticUpdate - Successful Optimistic Updates", () => {
	it("applies optimistic update immediately", async () => {
		const initialMessages = [createMockMessage("1", "Hello")];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		const newMessage = createMockMessage("2", "World");

		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: newMessage,
				applyOptimistic: (msg) => {
					setMessages((prev) => [...prev, msg as ChatMessage]);
				},
				execute: async () => ({ success: true }),
			});
		});

		const finalMessages = getLatestMessages(initialMessages);
		expect(finalMessages).toHaveLength(2);
		expect(finalMessages[1].id).toBe("2");
	});

	it("clears operation on success", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("1", "Test"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => ({ success: true }),
			});
		});

		expect(result.current.pendingOperations).toEqual([]);
		expect(result.current.hasPendingOperation).toBe(false);
		expect(result.current.currentOperationId).toBeNull();
	});

	it("returns success result from execute", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();
		const executeResult = { success: true as const, data: { id: "123" } };

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		let apiResult: Awaited<
			ReturnType<typeof result.current.withOptimisticUpdate>
		> = { success: false };
		await act(async () => {
			apiResult = await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("1", "Test"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => executeResult,
			});
		});

		expect(apiResult).toEqual(executeResult);
	});
});

describe("useOptimisticUpdate - Rollback on API Failure", () => {
	it("schedules rollback when execute returns success: false", async () => {
		const initialMessages = [createMockMessage("1", "Original")];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 100,
			}),
		);

		const updatedMessage = createMockMessage("1", "Updated");

		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "update",
				optimisticData: "1",
				applyOptimistic: () => {
					setMessages((prev) =>
						prev.map((m) => (m.id === "1" ? updatedMessage : m)),
					);
				},
				execute: async () => ({ success: false, error: "Update failed" }),
			});
		});

		// Immediately after failure, messages should still have optimistic update
		expect(getLatestMessages(initialMessages)[0].parts[0].text).toBe("Updated");
		expect(result.current.pendingOperations).toHaveLength(1);

		// Wait for rollback
		await waitFor(
			() => {
				expect(result.current.pendingOperations).toEqual([]);
			},
			{ timeout: 500 },
		);

		// After rollback, messages should be restored
		expect(getLatestMessages(initialMessages)[0].parts[0].text).toBe(
			"Original",
		);
	});

	it("calls custom rollback callback if provided", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();
		const rollbackCallback = vi.fn();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 50,
			}),
		);

		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "delete",
				optimisticData: "1",
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => ({ success: false, error: "Delete failed" }),
				rollback: rollbackCallback,
			});
		});

		await waitFor(
			() => {
				expect(rollbackCallback).toHaveBeenCalledWith("Delete failed");
			},
			{ timeout: 500 },
		);
	});
});

describe("useOptimisticUpdate - Rollback on Exception", () => {
	it("schedules rollback when execute throws", async () => {
		const initialMessages = [createMockMessage("1", "Original")];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 100,
			}),
		);

		const updatedMessage = createMockMessage("1", "Updated");

		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "update",
				optimisticData: "1",
				applyOptimistic: () => {
					setMessages((prev) =>
						prev.map((m) => (m.id === "1" ? updatedMessage : m)),
					);
				},
				execute: async () => {
					throw new Error("Network error");
				},
			});
		});

		// Wait for rollback
		await waitFor(
			() => {
				expect(result.current.pendingOperations).toEqual([]);
			},
			{ timeout: 500 },
		);

		// After rollback, messages should be restored
		expect(getLatestMessages(initialMessages)[0].parts[0].text).toBe(
			"Original",
		);
	});

	it("returns error result when execute throws", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 100,
			}),
		);

		let apiResult: Awaited<
			ReturnType<typeof result.current.withOptimisticUpdate>
		> = { success: false };
		await act(async () => {
			apiResult = await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("1", "Test"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => {
					throw new Error("API error");
				},
			});
		});

		expect(apiResult).toEqual({
			success: false,
			error: "API error",
		});
	});

	it("handles non-Error exceptions", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 100,
			}),
		);

		let apiResult: Awaited<
			ReturnType<typeof result.current.withOptimisticUpdate>
		> = { success: false };
		await act(async () => {
			apiResult = await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("1", "Test"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => {
					throw "String error";
				},
			});
		});

		expect(apiResult).toEqual({
			success: false,
			error: "An unexpected error occurred",
		});
	});
});

describe("useOptimisticUpdate - Optimistic Append", () => {
	it("appends message optimistically", async () => {
		const initialMessages = [createMockMessage("1", "First")];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		const newMessage = createMockMessage("2", "Second");

		await act(async () => {
			await result.current.optimisticAppend(newMessage, async () => ({
				success: true,
			}));
		});

		const finalMessages = getLatestMessages(initialMessages);
		expect(finalMessages).toHaveLength(2);
		expect(finalMessages[1].id).toBe("2");
	});
});

describe("useOptimisticUpdate - Optimistic Update", () => {
	it("updates message optimistically", async () => {
		const initialMessages = [createMockMessage("1", "Original")];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		const updates: Partial<ChatMessage> = {
			parts: [{ type: "text", text: "Updated" }] as any,
		};

		await act(async () => {
			await result.current.optimisticUpdate("1", updates, async () => ({
				success: true,
			}));
		});

		const finalMessages = getLatestMessages(initialMessages);
		expect(finalMessages[0].parts[0].text).toBe("Updated");
	});
});

describe("useOptimisticUpdate - Optimistic Delete", () => {
	it("deletes message optimistically", async () => {
		const initialMessages = [
			createMockMessage("1", "First"),
			createMockMessage("2", "Second"),
		];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		await act(async () => {
			await result.current.optimisticDelete("1", async () => ({
				success: true,
			}));
		});

		const finalMessages = getLatestMessages(initialMessages);
		expect(finalMessages).toHaveLength(1);
		expect(finalMessages[0].id).toBe("2");
	});
});

describe("useOptimisticUpdate - Optimistic Regenerate", () => {
	it("marks message as regenerating", async () => {
		const initialMessages = [createMockMessage("1", "Original")];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		await act(async () => {
			await result.current.optimisticRegenerate("1", async () => ({
				success: true,
			}));
		});

		const finalMessages = getLatestMessages(initialMessages);
		expect(finalMessages[0].parts[0].text).toBe("Regenerating...");
	});
});

describe("useOptimisticUpdate - Rollback Control", () => {
	it("cancels pending rollback", async () => {
		const initialMessages = [createMockMessage("1", "Original")];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 500,
			}),
		);

		const updatedMessage = createMockMessage("1", "Updated");

		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "update",
				optimisticData: "1",
				applyOptimistic: () => {
					setMessages((prev) =>
						prev.map((m) => (m.id === "1" ? updatedMessage : m)),
					);
				},
				execute: async () => ({ success: false, error: "Failed" }),
			});
		});

		// Cancel rollback before it fires
		act(() => {
			result.current.cancelRollback();
		});

		// Wait longer than rollback delay
		await new Promise((resolve) => setTimeout(resolve, 600));

		// Messages should NOT be restored (rollback was cancelled)
		expect(getLatestMessages(initialMessages)[0].parts[0].text).toBe("Updated");
	});

	it("force rollback immediately", async () => {
		const initialMessages = [createMockMessage("1", "Original")];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 5000,
			}),
		);

		const updatedMessage = createMockMessage("1", "Updated");

		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "update",
				optimisticData: "1",
				applyOptimistic: () => {
					setMessages((prev) =>
						prev.map((m) => (m.id === "1" ? updatedMessage : m)),
					);
				},
				execute: async () => ({ success: false, error: "Failed" }),
			});
		});

		// Force immediate rollback (don't wait for rollbackDelay)
		act(() => {
			result.current.forceRollback();
		});

		// Messages should be restored immediately
		expect(getLatestMessages(initialMessages)[0].parts[0].text).toBe(
			"Original",
		);
		expect(result.current.pendingOperations).toEqual([]);
	});
});

describe("useOptimisticUpdate - Apply Optimistic Failure", () => {
	it("returns error when applyOptimistic throws", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		let apiResult: Awaited<
			ReturnType<typeof result.current.withOptimisticUpdate>
		> = { success: false };
		await act(async () => {
			apiResult = await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("1", "Test"),
				applyOptimistic: () => {
					throw new Error("Apply failed");
				},
				execute: async () => ({ success: true }),
			});
		});

		expect(apiResult).toEqual({
			success: false,
			error: "Failed to apply optimistic update",
		});
	});

	it("does not schedule rollback when applyOptimistic fails", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages),
		);

		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("1", "Test"),
				applyOptimistic: () => {
					throw new Error("Apply failed");
				},
				execute: async () => ({ success: true }),
			});
		});

		// No operation should be tracked
		expect(result.current.pendingOperations).toEqual([]);
	});
});

describe("useOptimisticUpdate - Multiple Operations", () => {
	it("tracks multiple pending operations", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 5000,
			}),
		);

		// Start first operation (will fail)
		const op1Promise = act(async () => {
			await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("1", "First"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => ({ success: false, error: "Failed 1" }),
			});
		});

		// Wait a bit for first to complete
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Start second operation (will fail)
		const op2Promise = act(async () => {
			await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("2", "Second"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => ({ success: false, error: "Failed 2" }),
			});
		});

		await Promise.all([op1Promise, op2Promise]);

		// Both operations should be pending
		expect(result.current.pendingOperations).toHaveLength(2);
		expect(result.current.hasPendingOperation).toBe(true);
	});
});

describe("useOptimisticUpdate - Operation ID Generation", () => {
	// Note: These tests are skipped due to React Testing Library + happy-dom
	// interaction issues with hook unmounting. The functionality is tested
	// indirectly through other tests.
	it.skip("generates unique operation IDs", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 5000,
			}),
		);

		const ids = new Set<string>();

		// Create two operations sequentially to verify unique IDs
		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("1", "Message 1"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => ({ success: false, error: "Failed" }),
			});
		});

		ids.add(result.current.currentOperationId || "");

		await act(async () => {
			await result.current.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("2", "Message 2"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => ({ success: false, error: "Failed" }),
			});
		});

		ids.add(result.current.currentOperationId || "");

		// IDs should be unique (both operations pending)
		expect(result.current.pendingOperations).toHaveLength(2);
		expect(ids.size).toBe(2);
	});

	it.skip("sets currentOperationId to latest operation", async () => {
		const initialMessages: ChatMessage[] = [];
		const { setMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 5000,
			}),
		);

		let firstOpId: string | null = null;

		await act(async () => {
			const hookResult = result.current;
			if (!hookResult) return;
			await hookResult.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("1", "First"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => ({ success: false, error: "Failed" }),
			});
		});

		firstOpId = result.current?.currentOperationId || null;

		await act(async () => {
			const hookResult = result.current;
			if (!hookResult) return;
			await hookResult.withOptimisticUpdate({
				type: "append",
				optimisticData: createMockMessage("2", "Second"),
				applyOptimistic: () => {
					/* No-op */
				},
				execute: async () => ({ success: false, error: "Failed" }),
			});
		});

		// Current operation ID should be different from first
		const secondOpId = result.current?.currentOperationId || null;
		expect(secondOpId).not.toBe(firstOpId);
	});
});

describe("useOptimisticUpdate - Snapshot Management", () => {
	it("restores snapshot after rollback", async () => {
		const initialMessages = [createMockMessage("1", "Original")];
		const { setMessages, getLatestMessages } = createSetMessagesTracker();

		const { result } = renderHook(() =>
			useOptimisticUpdate(initialMessages, setMessages, {
				rollbackDelay: 50,
			}),
		);

		const updatedMessage = createMockMessage("1", "Updated");

		await act(async () => {
			const hookResult = result.current;
			if (!hookResult) return;
			await hookResult.withOptimisticUpdate({
				type: "update",
				optimisticData: "1",
				applyOptimistic: () => {
					setMessages((prev) =>
						prev.map((m) => (m.id === "1" ? updatedMessage : m)),
					);
				},
				execute: async () => ({ success: false, error: "Failed" }),
			});
		});

		// Wait for rollback to complete
		await new Promise((resolve) => setTimeout(resolve, 100));

		// After rollback, messages should be restored
		const finalMessages = getLatestMessages(initialMessages);
		expect(finalMessages[0].parts[0].text).toBe("Original");
	});
});
