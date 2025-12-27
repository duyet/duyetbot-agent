/**
 * Unit tests for mention-parser.ts
 */
import { describe, expect, it } from "vitest";
import {
	resolveToolId,
	parseMentions,
	detectMentionTrigger,
	filterTools,
	completeMention,
	getToolById,
	MENTIONABLE_TOOLS,
} from "./mention-parser";

describe("resolveToolId", () => {
	it("resolves exact tool aliases", () => {
		expect(resolveToolId("websearch")).toBe("web_search");
		expect(resolveToolId("search")).toBe("web_search");
		expect(resolveToolId("weather")).toBe("getWeather");
		expect(resolveToolId("plan")).toBe("plan");
	});

	it("is case insensitive", () => {
		expect(resolveToolId("WebSearch")).toBe("web_search");
		expect(resolveToolId("WEATHER")).toBe("getWeather");
		expect(resolveToolId("Plan")).toBe("plan");
	});

	it("returns null for unknown aliases", () => {
		expect(resolveToolId("unknown")).toBeNull();
		expect(resolveToolId("foobar")).toBeNull();
		expect(resolveToolId("")).toBeNull();
	});
});

describe("parseMentions", () => {
	it("parses single mention", () => {
		const result = parseMentions("@websearch what is AI?");
		expect(result.mentionedToolIds).toEqual(["web_search"]);
		expect(result.mentions).toHaveLength(1);
		expect(result.mentions[0].toolId).toBe("web_search");
		expect(result.cleanText).toBe("what is AI?");
	});

	it("parses multiple mentions", () => {
		const result = parseMentions("@weather in Tokyo @plan my trip");
		expect(result.mentionedToolIds).toEqual(["getWeather", "plan"]);
		expect(result.mentions).toHaveLength(2);
		expect(result.cleanText).toBe("in Tokyo my trip");
	});

	it("handles text without mentions", () => {
		const result = parseMentions("Hello, how are you?");
		expect(result.mentionedToolIds).toEqual([]);
		expect(result.mentions).toHaveLength(0);
		expect(result.cleanText).toBe("Hello, how are you?");
	});

	it("ignores invalid mentions", () => {
		const result = parseMentions("@unknown @foobar test");
		expect(result.mentionedToolIds).toEqual([]);
		expect(result.cleanText).toBe("@unknown @foobar test");
	});

	it("handles mention at end of text", () => {
		const result = parseMentions("search for news @websearch");
		expect(result.mentionedToolIds).toEqual(["web_search"]);
		expect(result.cleanText).toBe("search for news");
	});

	it("deduplicates repeated mentions", () => {
		const result = parseMentions("@search first @websearch second");
		expect(result.mentionedToolIds).toEqual(["web_search"]);
		expect(result.mentions).toHaveLength(2);
	});
});

describe("detectMentionTrigger", () => {
	it("detects active trigger after @", () => {
		const result = detectMentionTrigger("Hello @", 7);
		expect(result.isActive).toBe(true);
		expect(result.query).toBe("");
		expect(result.startIndex).toBe(6);
	});

	it("captures partial query after @", () => {
		const result = detectMentionTrigger("Hello @wea", 10);
		expect(result.isActive).toBe(true);
		expect(result.query).toBe("wea");
		expect(result.startIndex).toBe(6);
	});

	it("is inactive when space after mention", () => {
		const result = detectMentionTrigger("Hello @weather ", 15);
		expect(result.isActive).toBe(false);
	});

	it("is inactive without @", () => {
		const result = detectMentionTrigger("Hello world", 11);
		expect(result.isActive).toBe(false);
	});

	it("is inactive when @ is part of email", () => {
		const result = detectMentionTrigger("email@example.com", 17);
		expect(result.isActive).toBe(false);
	});

	it("detects @ at start of text", () => {
		const result = detectMentionTrigger("@web", 4);
		expect(result.isActive).toBe(true);
		expect(result.query).toBe("web");
		expect(result.startIndex).toBe(0);
	});
});

describe("filterTools", () => {
	it("returns all tools for empty query", () => {
		const result = filterTools("");
		expect(result).toEqual(MENTIONABLE_TOOLS);
	});

	it("filters by tool ID", () => {
		const result = filterTools("web_search");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("web_search");
	});

	it("filters by tool name", () => {
		const result = filterTools("Weather");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("getWeather");
	});

	it("filters by partial match", () => {
		const result = filterTools("sea");
		expect(result.some((t) => t.id === "web_search")).toBe(true);
	});

	it("filters by alias", () => {
		const result = filterTools("google");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("web_search");
	});

	it("returns empty array for no matches", () => {
		const result = filterTools("xyznonexistent");
		expect(result).toHaveLength(0);
	});
});

describe("completeMention", () => {
	it("completes mention at cursor position", () => {
		const trigger = {
			isActive: true,
			query: "wea",
			startIndex: 6,
			cursorPosition: 10,
		};
		const tool = { id: "getWeather", name: "Weather", description: "" };
		const result = completeMention("Hello @wea", trigger, tool);

		expect(result.newText).toBe("Hello @getWeather ");
		expect(result.newCursorPosition).toBe(18);
	});

	it("preserves text after cursor without extra space", () => {
		const trigger = {
			isActive: true,
			query: "web",
			startIndex: 0,
			cursorPosition: 4,
		};
		const tool = { id: "web_search", name: "Web Search", description: "" };
		const result = completeMention("@web something", trigger, tool);

		// Should not add extra space since " something" already starts with space
		expect(result.newText).toBe("@web_search something");
	});
});

describe("getToolById", () => {
	it("returns tool by ID", () => {
		const tool = getToolById("web_search");
		expect(tool?.name).toBe("Web Search");
	});

	it("returns undefined for unknown ID", () => {
		const tool = getToolById("unknown");
		expect(tool).toBeUndefined();
	});
});
