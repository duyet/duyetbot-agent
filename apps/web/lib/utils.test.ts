/**
 * Unit tests for lib/utils.ts
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
	cn,
	generateUUID,
	getLocalStorage,
	setLocalStorage,
	getMostRecentUserMessage,
	getTextFromMessage,
	sanitizeText,
	getTrailingMessageId,
	convertToUIMessages,
} from "./utils";
import type { UIMessage } from "ai";
import type { DBMessage } from "./db/schema";

describe("cn (className merge)", () => {
	it("merges multiple class names", () => {
		const result = cn("foo", "bar");
		expect(result).toBe("foo bar");
	});

	it("handles conditional classes", () => {
		const result = cn("base", true && "active", false && "hidden");
		expect(result).toBe("base active");
	});

	it("merges tailwind classes correctly", () => {
		const result = cn("px-2 py-1", "px-4");
		expect(result).toBe("py-1 px-4");
	});

	it("handles empty inputs", () => {
		const result = cn();
		expect(result).toBe("");
	});

	it("handles undefined and null", () => {
		const result = cn("base", undefined, null, "end");
		expect(result).toBe("base end");
	});
});

describe("generateUUID", () => {
	it("generates valid UUID v4 format", () => {
		const uuid = generateUUID();
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(uuid).toMatch(uuidRegex);
	});

	it("generates unique UUIDs", () => {
		const uuids = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			uuids.add(generateUUID());
		}
		expect(uuids.size).toBe(1000);
	});

	it("always has version 4 in correct position", () => {
		for (let i = 0; i < 100; i++) {
			const uuid = generateUUID();
			expect(uuid[14]).toBe("4");
		}
	});

	it("has valid variant bits", () => {
		for (let i = 0; i < 100; i++) {
			const uuid = generateUUID();
			const variantChar = uuid[19];
			expect(["8", "9", "a", "b"]).toContain(variantChar);
		}
	});
});

describe("getLocalStorage", () => {
	const originalWindow = global.window;
	const originalLocalStorage = global.localStorage;

	beforeEach(() => {
		// Mock localStorage
		const store: Record<string, string> = {};
		global.localStorage = {
			getItem: vi.fn((key: string) => store[key] ?? null),
			setItem: vi.fn((key: string, value: string) => {
				store[key] = value;
			}),
			removeItem: vi.fn((key: string) => {
				delete store[key];
			}),
			clear: vi.fn(() => {
				Object.keys(store).forEach((key) => delete store[key]);
			}),
			length: 0,
			key: vi.fn(() => null),
		};
		// Define window to enable localStorage checks
		global.window = {} as typeof window;
	});

	afterEach(() => {
		global.window = originalWindow;
		global.localStorage = originalLocalStorage;
	});

	it("returns empty array when key does not exist", () => {
		const result = getLocalStorage("nonexistent");
		expect(result).toEqual([]);
	});

	it("returns parsed JSON array", () => {
		const data = [1, 2, 3];
		localStorage.setItem("test", JSON.stringify(data));
		const result = getLocalStorage("test");
		expect(result).toEqual(data);
	});

	it("returns empty array on invalid JSON", () => {
		(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(
			"invalid json",
		);
		const result = getLocalStorage("invalid");
		expect(result).toEqual([]);
	});

	it("returns empty array when window is undefined (SSR)", () => {
		global.window = undefined as unknown as typeof window;
		const result = getLocalStorage("test");
		expect(result).toEqual([]);
	});
});

describe("setLocalStorage", () => {
	const originalWindow = global.window;
	const originalLocalStorage = global.localStorage;

	beforeEach(() => {
		const store: Record<string, string> = {};
		global.localStorage = {
			getItem: vi.fn((key: string) => store[key] ?? null),
			setItem: vi.fn((key: string, value: string) => {
				store[key] = value;
			}),
			removeItem: vi.fn(),
			clear: vi.fn(),
			length: 0,
			key: vi.fn(() => null),
		};
		global.window = {} as typeof window;
	});

	afterEach(() => {
		global.window = originalWindow;
		global.localStorage = originalLocalStorage;
	});

	it("returns true on successful write", () => {
		const result = setLocalStorage("key", { foo: "bar" });
		expect(result).toBe(true);
	});

	it("stores JSON stringified value", () => {
		const data = { foo: "bar", num: 42 };
		setLocalStorage("test", data);
		expect(localStorage.setItem).toHaveBeenCalledWith(
			"test",
			JSON.stringify(data),
		);
	});

	it("returns false when window is undefined (SSR)", () => {
		global.window = undefined as unknown as typeof window;
		const result = setLocalStorage("key", "value");
		expect(result).toBe(false);
	});

	it("returns false on storage error", () => {
		(localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementationOnce(
			() => {
				throw new Error("QuotaExceededError");
			},
		);
		const result = setLocalStorage("key", "value");
		expect(result).toBe(false);
	});
});

describe("getMostRecentUserMessage", () => {
	it("returns the last user message", () => {
		const messages: UIMessage[] = [
			{ id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] },
			{ id: "2", role: "assistant", parts: [{ type: "text", text: "Hi" }] },
			{ id: "3", role: "user", parts: [{ type: "text", text: "World" }] },
		];
		const result = getMostRecentUserMessage(messages);
		expect(result?.id).toBe("3");
	});

	it("returns undefined when no user messages exist", () => {
		const messages: UIMessage[] = [
			{ id: "1", role: "assistant", parts: [{ type: "text", text: "Hi" }] },
		];
		const result = getMostRecentUserMessage(messages);
		expect(result).toBeUndefined();
	});

	it("returns undefined for empty array", () => {
		const result = getMostRecentUserMessage([]);
		expect(result).toBeUndefined();
	});
});

describe("getTextFromMessage", () => {
	it("extracts text from text parts", () => {
		const message = {
			id: "1",
			role: "user" as const,
			parts: [
				{ type: "text" as const, text: "Hello " },
				{ type: "text" as const, text: "World" },
			],
		};
		const result = getTextFromMessage(message);
		expect(result).toBe("Hello World");
	});

	it("ignores non-text parts", () => {
		const message = {
			id: "1",
			role: "user" as const,
			parts: [
				{ type: "text" as const, text: "Hello" },
				{ type: "tool-invocation" as const, toolInvocationId: "1" },
				{ type: "text" as const, text: " World" },
			],
		};
		const result = getTextFromMessage(message as unknown as UIMessage);
		expect(result).toBe("Hello World");
	});

	it("returns empty string for message with no text parts", () => {
		const message = {
			id: "1",
			role: "assistant" as const,
			parts: [{ type: "tool-invocation" as const, toolInvocationId: "1" }],
		};
		const result = getTextFromMessage(message as unknown as UIMessage);
		expect(result).toBe("");
	});
});

describe("sanitizeText", () => {
	it("removes <has_function_call> tag", () => {
		const text = "Hello <has_function_call>World";
		const result = sanitizeText(text);
		expect(result).toBe("Hello World");
	});

	it("handles text without the tag", () => {
		const text = "Hello World";
		const result = sanitizeText(text);
		expect(result).toBe("Hello World");
	});

	it("removes multiple occurrences", () => {
		const text = "A<has_function_call>B<has_function_call>C";
		const result = sanitizeText(text);
		expect(result).toBe("ABC");
	});
});

describe("getTrailingMessageId", () => {
	it("returns the id of the last message", () => {
		const messages = [
			{
				id: "msg-1",
				role: "assistant" as const,
				content: [{ type: "text" as const, text: "Hello" }],
			},
			{
				id: "msg-2",
				role: "assistant" as const,
				content: [{ type: "text" as const, text: "World" }],
			},
		];
		const result = getTrailingMessageId({ messages });
		expect(result).toBe("msg-2");
	});

	it("returns null for empty array", () => {
		const result = getTrailingMessageId({ messages: [] });
		expect(result).toBeNull();
	});
});

describe("convertToUIMessages", () => {
	it("converts DBMessage array to ChatMessage array", () => {
		const dbMessages: DBMessage[] = [
			{
				id: "1",
				chatId: "chat-1",
				role: "user",
				parts: [{ type: "text", text: "Hello" }],
				attachments: [],
				createdAt: new Date("2024-01-01T00:00:00Z"),
			},
			{
				id: "2",
				chatId: "chat-1",
				role: "assistant",
				parts: [{ type: "text", text: "Hi there!" }],
				attachments: [],
				createdAt: new Date("2024-01-01T00:00:01Z"),
			},
		];

		const result = convertToUIMessages(dbMessages);

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe("1");
		expect(result[0].role).toBe("user");
		expect(result[1].id).toBe("2");
		expect(result[1].role).toBe("assistant");
	});

	it("includes metadata with createdAt", () => {
		const dbMessages: DBMessage[] = [
			{
				id: "1",
				chatId: "chat-1",
				role: "user",
				parts: [],
				attachments: [],
				createdAt: new Date("2024-06-15T10:30:00Z"),
			},
		];

		const result = convertToUIMessages(dbMessages);
		expect(result[0].metadata).toBeDefined();
		expect(result[0].metadata?.createdAt).toContain("2024-06-15");
	});

	it("handles empty array", () => {
		const result = convertToUIMessages([]);
		expect(result).toEqual([]);
	});
});
