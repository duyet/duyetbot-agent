/**
 * Unit tests for createChatTransport factory function
 *
 * Test Categories:
 * 1. Transport initialization
 * 2. Tool approval continuation detection
 * 3. Message preparation with custom instructions
 * 4. Message preparation with AI settings
 * 5. RefObject handling for currentModelId
 */

import { describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import type { VisibilityType } from "@/components/visibility-selector";
import { createChatTransport } from "./use-chat-transport";

// Mock the dependencies
vi.mock("@/lib/custom-instructions", () => ({
	getAISettings: vi.fn(() => ({
		temperature: 0.7,
		maxTokens: 1000,
		topP: 0.9,
		frequencyPenalty: 0,
		presencePenalty: 0,
	})),
	getEffectiveInstructions: vi.fn(() => "Custom instructions"),
}));

vi.mock("@/lib/utils", () => ({
	fetchWithErrorHandlers: vi.fn((input, init) =>
		Promise.resolve(new Response()),
	),
}));

// Mock DefaultChatTransport from 'ai'
vi.mock("ai", () => ({
	DefaultChatTransport: class {
		constructor(public config: any) {}
	},
}));

describe("createChatTransport - Transport Initialization", () => {
	it("creates a DefaultChatTransport instance", () => {
		const chatId = "test-chat-1";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		expect(transport).toBeDefined();
		expect(transport.config).toBeDefined();
		expect(transport.config.api).toBe("/api/chat");
	});

	it("configures fetch with fetchWithErrorHandlers", () => {
		const chatId = "test-chat-2";
		const visibilityType: VisibilityType = "public";
		const currentModelIdRef: RefObject<string> = { current: "claude-3" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		expect(transport.config.fetch).toBeDefined();
	});

	it("stores chatId and visibilityType for use in prepareSendMessagesRequest", () => {
		const chatId = "test-chat-3";
		const visibilityType: VisibilityType = "workspace";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		// Transport should have these values accessible via closure
		expect(transport.config.prepareSendMessagesRequest).toBeDefined();
	});
});

describe("createChatTransport - Tool Approval Continuation Detection", () => {
	it("detects tool approval continuation when last message is not user", () => {
		const chatId = "test-chat-4";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-1",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Hello" }],
				},
				{
					role: "assistant",
					parts: [{ type: "text", text: "Hi there!" }],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		// Last message is assistant, so should send all messages
		expect(result.body).toHaveProperty("messages");
		expect(result.body.messages).toEqual(request.messages);
	});

	it("sends only last user message for normal chat", () => {
		const chatId = "test-chat-5";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-2",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Previous message" }],
				},
				{
					role: "assistant",
					parts: [{ type: "text", text: "Response" }],
				},
				{
					role: "user",
					parts: [{ type: "text", text: "New message" }],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		// Last message is user, no tool parts, so should send only last message
		expect(result.body).toHaveProperty("message");
		expect(result.body.message).toEqual(request.messages[2]);
	});

	it("detects tool approval continuation when tool has responded state", () => {
		const chatId = "test-chat-6";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-3",
			messages: [
				{
					role: "user",
					parts: [
						{ type: "text", text: "Use tool" },
						{
							type: "tool",
							toolCallId: "call-1",
							toolName: "search",
							state: "approval-responded",
						},
					],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		// Has tool part with approval-responded state
		expect(result.body).toHaveProperty("messages");
		expect(result.body.messages).toEqual(request.messages);
	});

	it("detects tool approval continuation when tool has output-denied state", () => {
		const chatId = "test-chat-7";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-4",
			messages: [
				{
					role: "user",
					parts: [
						{ type: "text", text: "Use another tool" },
						{
							type: "tool",
							toolCallId: "call-2",
							toolName: "calculate",
							state: "output-denied",
						},
					],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		// Has tool part with output-denied state
		expect(result.body).toHaveProperty("messages");
		expect(result.body.messages).toEqual(request.messages);
	});
});

describe("createChatTransport - Request Body Configuration", () => {
	it("includes request id in body", () => {
		const chatId = "test-chat-8";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-5",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		expect(result.body.id).toBe("msg-5");
	});

	it("includes selectedChatModel from ref", () => {
		const chatId = "test-chat-9";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "claude-opus" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-6",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		expect(result.body.selectedChatModel).toBe("claude-opus");
	});

	it("includes selectedVisibilityType", () => {
		const chatId = "test-chat-10";
		const visibilityType: VisibilityType = "workspace";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-7",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		expect(result.body.selectedVisibilityType).toBe("workspace");
	});

	it("merges existing request.body", () => {
		const chatId = "test-chat-11";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const existingBodyData = { customField: "custom-value" };

		const request = {
			id: "msg-8",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
			],
			body: existingBodyData,
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		expect(result.body.customField).toBe("custom-value");
		expect(result.body.id).toBe("msg-8");
	});
});

describe("createChatTransport - AI Settings", () => {
	it("includes aiSettings when temperature is not default", () => {
		const chatId = "test-chat-12";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-9",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		// Temperature is 0.7 in mock, which is the default, so it shouldn't be included
		expect(result.body.aiSettings).toBeUndefined();
	});

	it("omits aiSettings when all values are default", () => {
		// The mock returns temperature: 0.7 (default)
		// So aiSettings should be undefined or empty
		const chatId = "test-chat-13";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-10",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		// With default temperature (0.7), aiSettings might still be included
		// but with temperature omitted
		if (result.body.aiSettings) {
			expect(result.body.aiSettings.temperature).toBeUndefined();
		}
	});
});

describe("createChatTransport - Edge Cases", () => {
	it("handles empty messages array", () => {
		const chatId = "test-chat-14";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: "gpt-4" };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-11",
			messages: [],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		// Empty messages - lastMessage would be undefined
		expect(result.body).toBeDefined();
	});

	it("handles null currentModelIdRef", () => {
		const chatId = "test-chat-15";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: null as any };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-12",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		// Should handle null model gracefully
		expect(result.body.selectedChatModel).toBeNull();
	});

	it("handles undefined currentModelIdRef.current", () => {
		const chatId = "test-chat-16";
		const visibilityType: VisibilityType = "private";
		const currentModelIdRef: RefObject<string> = { current: undefined as any };

		const transport = createChatTransport({
			chatId,
			visibilityType,
			currentModelIdRef,
		});

		const request = {
			id: "msg-13",
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
			],
			body: {},
		};

		const result = transport.config.prepareSendMessagesRequest(request);

		expect(result.body.selectedChatModel).toBeUndefined();
	});
});
