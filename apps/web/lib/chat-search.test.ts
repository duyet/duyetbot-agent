/**
 * Unit tests for chat-search
 *
 * Note: This module uses "server-only" and requires complex database mocking.
 * These tests verify that the correct database queries are constructed.
 * Full integration testing would require a test database.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock server-only module before importing chat-search
vi.mock("server-only", () => ({}));

import { searchChats, getSearchSuggestions, getRecentChats } from "./chat-search";

// Mock dependencies
vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(() =>
		Promise.resolve({
			env: {
				DB: {},
			},
		}),
	),
}));

vi.mock("@/lib/db", () => ({
	createDb: vi.fn(() => mockDb),
}));

vi.mock("@/lib/db/schema", () => ({
	chat: {},
	chatFolder: {},
	chatTag: {},
	chatToFolder: {},
	chatToTag: {},
	message: {},
}));

import { eq, and, desc, inArray, like, sql } from "drizzle-orm";

// Mock drizzle ORM functions
vi.mock("drizzle-orm", () => ({
	and: vi.fn((...args: any[]) => ({ _type: "and", args })),
	desc: vi.fn((col: any) => ({ _type: "desc", col })),
	eq: vi.fn((col: any, val: any) => ({ _type: "eq", col, val })),
	inArray: vi.fn((col: any, vals: any[]) => ({ _type: "inArray", col, vals })),
	like: vi.fn((col: any, val: any) => ({ _type: "like", col, val })),
	sql: vi.fn((frag: any) => ({ _type: "sql", frag })),
}));

// Mock database interface with proper chaining
const mockDb = {
	select: vi.fn(() => mockDb),
	from: vi.fn(() => mockDb),
	where: vi.fn(() => mockDb),
	orderBy: vi.fn(() => mockDb),
	limit: vi.fn(() => mockDb),
	innerJoin: vi.fn(() => mockDb),
	selectDistinct: vi.fn(() => mockDb),
	execute: vi.fn(async () => []),
};

describe("chat-search - searchChats", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("builds query with LIKE operator for title search", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await searchChats({
			userId: "user-123",
			query: "react",
		});

		// Verify LIKE was called with query
		expect(like).toHaveBeenCalledWith(expect.anything(), "%react%");
	});

	it("builds query with eq for userId", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await searchChats({
			userId: "user-123",
			query: "test",
		});

		// Verify eq was called for userId
		expect(eq).toHaveBeenCalledWith(expect.anything(), "user-123");
	});

	it("returns empty array when no matches", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		const results = await searchChats({
			userId: "user-123",
			query: "nonexistent",
		});

		expect(results).toEqual([]);
	});

	it("calls execute on database", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await searchChats({
			userId: "user-123",
			query: "test",
		});

		expect(mockDb.execute).toHaveBeenCalled();
	});

	it("respects limit parameter", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await searchChats({
			userId: "user-123",
			query: "test",
			limit: 10,
		});

		expect(mockDb.limit).toHaveBeenCalledWith(10);
	});
});

describe("chat-search - getSearchSuggestions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns empty array for short queries", async () => {
		const results = await getSearchSuggestions("user-123", "a");

		expect(results).toEqual([]);
	});

	it("returns empty array for empty query", async () => {
		const results = await getSearchSuggestions("user-123", "");

		expect(results).toEqual([]);
	});

	it("builds query with LIKE for partial match", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await getSearchSuggestions("user-123", "react");

		expect(like).toHaveBeenCalledWith(expect.anything(), "%react%");
	});

	it("respects limit parameter", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await getSearchSuggestions("user-123", "test", 5);

		expect(mockDb.limit).toHaveBeenCalledWith(5);
	});

	it("uses default limit of 5 when not specified", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await getSearchSuggestions("user-123", "test");

		expect(mockDb.limit).toHaveBeenCalledWith(5);
	});
});

describe("chat-search - getRecentChats", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("builds query with eq for userId", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await getRecentChats("user-123");

		expect(eq).toHaveBeenCalled();
	});

	it("orders by creation date descending", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await getRecentChats("user-123");

		expect(desc).toHaveBeenCalled();
	});

	it("respects limit parameter", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await getRecentChats("user-123", 20);

		expect(mockDb.limit).toHaveBeenCalledWith(20);
	});

	it("uses default limit of 10 when not specified", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await getRecentChats("user-123");

		expect(mockDb.limit).toHaveBeenCalledWith(10);
	});

	it("calls execute on database", async () => {
		mockDb.execute.mockResolvedValueOnce([]);

		await getRecentChats("user-123");

		expect(mockDb.execute).toHaveBeenCalled();
	});
});
