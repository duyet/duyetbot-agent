/**
 * Unit tests for chat-memory hook
 *
 * Test Categories:
 * 1. Hook initialization and state
 * 2. Memory CRUD operations (add, update, delete)
 * 3. localStorage persistence
 * 4. Memory filtering and search
 * 5. Importance decay and boost
 * 6. Context generation for AI
 * 7. Import/export functionality
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryEntry, MemoryType } from "@/lib/chat-memory";
import {
	clearAllMemories,
	exportMemories,
	getAllMemories,
	importMemories,
	useChatMemory,
} from "@/lib/chat-memory";

// Mock localStorage
const mockStorage = new Map<string, string>();

const mockGetItem = vi.fn((key: string) => mockStorage.get(key) || null);
const mockSetItem = vi.fn((key: string, value: string) => {
	mockStorage.set(key, value);
});
const mockRemoveItem = vi.fn((key: string) => {
	mockStorage.delete(key);
});

beforeEach(() => {
	vi.clearAllMocks();
	mockStorage.clear();
	vi.stubGlobal("localStorage", {
		getItem: mockGetItem,
		setItem: mockSetItem,
		removeItem: mockRemoveItem,
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("chat-memory - Hook Initialization", () => {
	it("initializes with empty memories for new chat", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		expect(result.current.memories).toEqual([]);
	});

	it("loads existing memories from localStorage", async () => {
		const existingMemories: MemoryEntry[] = [
			{
				id: "mem-1",
				chatId: "chat-123",
				type: "fact",
				content: "Important fact",
				importance: 0.8,
				timestamp: new Date().toISOString(),
				accessCount: 0,
				lastAccessed: new Date().toISOString(),
			},
		];
		mockStorage.set("chat-memory-store", JSON.stringify(existingMemories));

		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		expect(result.current.memories).toHaveLength(1);
		expect(result.current.memories[0].content).toBe("Important fact");
	});

	it("filters memories by chatId on load", async () => {
		const allMemories: MemoryEntry[] = [
			{
				id: "mem-1",
				chatId: "chat-123",
				type: "fact",
				content: "Chat 123 memory",
				importance: 0.8,
				timestamp: new Date().toISOString(),
				accessCount: 0,
				lastAccessed: new Date().toISOString(),
			},
			{
				id: "mem-2",
				chatId: "chat-456",
				type: "fact",
				content: "Chat 456 memory",
				importance: 0.7,
				timestamp: new Date().toISOString(),
				accessCount: 0,
				lastAccessed: new Date().toISOString(),
			},
		];
		mockStorage.set("chat-memory-store", JSON.stringify(allMemories));

		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		expect(result.current.memories).toHaveLength(1);
		expect(result.current.memories[0].chatId).toBe("chat-123");
	});

	it("applies importance decay on load", async () => {
		const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
		const oldMemories: MemoryEntry[] = [
			{
				id: "mem-1",
				chatId: "chat-123",
				type: "fact",
				content: "Old memory",
				importance: 0.9,
				timestamp: oldDate.toISOString(),
				accessCount: 0,
				lastAccessed: oldDate.toISOString(),
			},
		];
		mockStorage.set("chat-memory-store", JSON.stringify(oldMemories));

		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		// Importance should have decayed (0.9 - 10 * 0.01 = 0.8, clamped to min 0.1)
		expect(result.current.memories[0].importance).toBeLessThan(0.9);
	});
});

describe("chat-memory - Add Memory", () => {
	it("adds new memory with auto-generated ID", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Test content", 0.7);
		});

		expect(result.current.memories).toHaveLength(1);
		expect(result.current.memories[0].id).toMatch(/^mem_\d+_/);
		expect(result.current.memories[0].content).toBe("Test content");
		expect(result.current.memories[0].importance).toBe(0.7);
	});

	it("clamps importance between 0 and 1", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Too high", 1.5);
		});

		act(() => {
			result.current.addMemory("preference", "Negative", -0.5);
		});

		expect(result.current.memories[0].importance).toBe(1);
		expect(result.current.memories[1].importance).toBe(0);
	});

	it("defaults importance to 0.5 when not specified", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Default importance");
		});

		expect(result.current.memories[0].importance).toBe(0.5);
	});

	it("stores metadata when provided", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		const metadata = { source: "user", tags: ["important"] };
		act(() => {
			result.current.addMemory("fact", "Content with metadata", 0.8, metadata);
		});

		expect(result.current.memories[0].metadata).toEqual(metadata);
	});

	it("enforces MAX_MEMORY_PER_CHAT limit", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		// Add more memories than the limit (50)
		for (let i = 0; i < 60; i++) {
			act(() => {
				result.current.addMemory("fact", `Memory ${i}`, 0.5 - i * 0.01);
			});
		}

		// Should only keep the 50 most important (highest importance = lowest index)
		expect(result.current.memories.length).toBeLessThanOrEqual(50);
	});

	it("saves to localStorage after adding", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Test", 0.7);
		});

		expect(mockSetItem).toHaveBeenCalled();
		const saved = mockStorage.get("chat-memory-store");
		expect(saved).toBeDefined();
		const parsed = JSON.parse(saved!);
		expect(parsed.some((m: MemoryEntry) => m.chatId === "chat-123")).toBe(true);
	});
});

describe("chat-memory - Update Memory", () => {
	it("updates existing memory by ID", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Original", 0.5);
		});

		const memoryId = result.current.memories[0].id;

		act(() => {
			result.current.updateMemory(memoryId, {
				content: "Updated",
				importance: 0.9,
			});
		});

		expect(result.current.memories[0].content).toBe("Updated");
		expect(result.current.memories[0].importance).toBe(0.9);
	});

	it("increments access count on update", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Test", 0.5);
		});

		const memoryId = result.current.memories[0].id;

		act(() => {
			result.current.updateMemory(memoryId, {});
		});

		expect(result.current.memories[0].accessCount).toBe(1);

		act(() => {
			result.current.updateMemory(memoryId, {});
		});

		expect(result.current.memories[0].accessCount).toBe(2);
	});

	it("updates lastAccessed timestamp", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Test", 0.5);
		});

		const memoryId = result.current.memories[0].id;
		const originalTimestamp = result.current.memories[0].lastAccessed;

		// Wait a bit to ensure timestamp difference
		await new Promise((resolve) => setTimeout(resolve, 10));

		act(() => {
			result.current.updateMemory(memoryId, {});
		});

		expect(result.current.memories[0].lastAccessed).not.toBe(originalTimestamp);
	});
});

describe("chat-memory - Delete Memory", () => {
	it("deletes memory by ID", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Memory 1", 0.5);
		});
		act(() => {
			result.current.addMemory("fact", "Memory 2", 0.6);
		});

		// Find the first memory (Memory 2 with higher importance)
		const firstMemory = result.current.memories.find(
			(m) => m.content === "Memory 2",
		);
		const memoryId = firstMemory?.id || "";

		act(() => {
			result.current.deleteMemory(memoryId);
		});

		expect(result.current.memories).toHaveLength(1);
		expect(result.current.memories[0].content).toBe("Memory 1");
	});
});

describe("chat-memory - Filter and Search", () => {
	it("gets memories by type", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Fact 1", 0.5);
		});
		act(() => {
			result.current.addMemory("preference", "Preference 1", 0.5);
		});
		act(() => {
			result.current.addMemory("fact", "Fact 2", 0.5);
		});

		const facts = result.current.getMemoriesByType("fact");
		expect(facts).toHaveLength(2);
		expect(facts.every((m) => m.type === "fact")).toBe(true);
	});

	it("searches memories by content", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "The user likes React", 0.5);
		});
		act(() => {
			result.current.addMemory("preference", "Prefers dark mode", 0.5);
		});
		act(() => {
			result.current.addMemory("fact", "Dislikes jQuery", 0.5);
		});

		const results = result.current.searchMemories("react");
		expect(results).toHaveLength(1);
		expect(results[0].content).toContain("React");
	});

	it("search is case-insensitive", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "User loves REACT framework", 0.5);
		});

		const results = result.current.searchMemories("react");
		expect(results).toHaveLength(1);
	});

	it("gets important memories above threshold", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "High importance", 0.9);
		});
		act(() => {
			result.current.addMemory("fact", "Medium importance", 0.7);
		});
		act(() => {
			result.current.addMemory("fact", "Low importance", 0.5);
		});

		const important = result.current.getImportantMemories(0.7);
		expect(important).toHaveLength(2);
		expect(important.every((m) => m.importance >= 0.7)).toBe(true);
	});

	it("gets recent memories within time range", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		// Add a memory
		act(() => {
			result.current.addMemory("fact", "Recent", 0.5);
		});

		const recent = result.current.getRecentMemories(24); // Last 24 hours
		expect(recent).toHaveLength(1);
	});
});

describe("chat-memory - Importance Management", () => {
	it("boosts memory importance by amount", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Test", 0.5);
		});

		const memoryId = result.current.memories[0].id;

		act(() => {
			result.current.boostImportance(memoryId, 0.2);
		});

		expect(result.current.memories[0].importance).toBe(0.7);
	});

	it("clamps boosted importance to maximum 1", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Test", 0.9);
		});

		const memoryId = result.current.memories[0].id;

		act(() => {
			result.current.boostImportance(memoryId, 0.5);
		});

		expect(result.current.memories[0].importance).toBe(1);
	});

	it("decays all memory importance", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Test 1", 0.9);
		});
		act(() => {
			result.current.addMemory("fact", "Test 2", 0.8);
		});

		act(() => {
			result.current.decayImportance();
		});

		// Both should have decayed by 0.01
		expect(result.current.memories[0].importance).toBeLessThan(0.9);
		expect(result.current.memories[1].importance).toBeLessThan(0.8);
	});

	it("clamps decayed importance to minimum 0.1", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Low importance", 0.11);
		});

		// Decay multiple times to hit minimum
		for (let i = 0; i < 5; i++) {
			act(() => {
				result.current.decayImportance();
			});
		}

		expect(result.current.memories[0].importance).toBe(0.1);
	});
});

describe("chat-memory - Context Generation", () => {
	it("generates context string for AI with important memories", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "User is a developer", 0.9);
		});
		act(() => {
			result.current.addMemory("preference", "Prefers TypeScript", 0.8);
		});

		const context = result.current.getContextForAI();

		expect(context).toContain("[fact]");
		expect(context).toContain("User is a developer");
		expect(context).toContain("[preference]");
		expect(context).toContain("Prefers TypeScript");
	});

	it("respects maxTokens limit", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		// Add memories with long content
		for (let i = 0; i < 10; i++) {
			act(() => {
				result.current.addMemory("fact", "A".repeat(200), 0.9);
			});
		}

		const context = result.current.getContextForAI(100);

		expect(context.length).toBeLessThanOrEqual(100);
	});

	it("combines important and recent memories", async () => {
		const { result } = renderHook(() => useChatMemory("chat-123"));

		await waitFor(() => {
			expect(result.current.isLoaded).toBe(true);
		});

		act(() => {
			result.current.addMemory("fact", "Important but old", 0.9);
		});
		act(() => {
			result.current.addMemory("context", "Recent but lower importance", 0.5);
		});

		const context = result.current.getContextForAI();

		expect(context).toContain("Important but old");
		expect(context).toContain("Recent but lower importance");
	});
});

describe("chat-memory - Utility Functions", () => {
	it("getAllMemories returns all stored memories", () => {
		const testMemories: MemoryEntry[] = [
			{
				id: "mem-1",
				chatId: "chat-1",
				type: "fact",
				content: "Test 1",
				importance: 0.5,
				timestamp: new Date().toISOString(),
				accessCount: 0,
				lastAccessed: new Date().toISOString(),
			},
		];
		mockStorage.set("chat-memory-store", JSON.stringify(testMemories));

		const all = getAllMemories();

		expect(all).toEqual(testMemories);
	});

	it("clearAllMemories removes storage", () => {
		mockStorage.set("chat-memory-store", JSON.stringify([{ id: "1" } as any]));

		clearAllMemories();

		expect(mockRemoveItem).toHaveBeenCalledWith("chat-memory-store");
	});

	it("exportMemories returns JSON string", () => {
		const testMemories: MemoryEntry[] = [
			{
				id: "mem-1",
				chatId: "chat-1",
				type: "fact",
				content: "Test",
				importance: 0.5,
				timestamp: new Date().toISOString(),
				accessCount: 0,
				lastAccessed: new Date().toISOString(),
			},
		];
		mockStorage.set("chat-memory-store", JSON.stringify(testMemories));

		const exported = exportMemories();

		expect(typeof exported).toBe("string");
		const parsed = JSON.parse(exported);
		expect(parsed.version).toBe("1.0");
		expect(parsed.memories).toEqual(testMemories);
	});

	it("importMemories loads valid JSON", () => {
		const data = {
			version: "1.0",
			memories: [
				{
					id: "mem-1",
					chatId: "chat-1",
					type: "fact",
					content: "Imported",
					importance: 0.7,
					timestamp: new Date().toISOString(),
					accessCount: 0,
					lastAccessed: new Date().toISOString(),
				},
			],
		};

		const result = importMemories(JSON.stringify(data));

		expect(result).toBe(true);
		expect(mockSetItem).toHaveBeenCalled();
		const stored = mockStorage.get("chat-memory-store");
		const parsed = JSON.parse(stored!);
		expect(parsed[0].content).toBe("Imported");
	});

	it("importMemories returns false for invalid JSON", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const result = importMemories("invalid json");

		expect(result).toBe(false);
		expect(consoleErrorSpy).toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it("importMemories returns false for missing memories array", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const result = importMemories(JSON.stringify({ version: "1.0" }));

		expect(result).toBe(false);

		consoleErrorSpy.mockRestore();
	});
});
