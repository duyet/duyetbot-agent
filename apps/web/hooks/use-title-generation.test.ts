/**
 * Unit tests for use-title-generation hook
 *
 * Test Categories:
 * 1. Hook initialization
 * 2. Title generation trigger conditions
 * 3. Title generation from first user message
 * 4. Skip generation for readonly chats
 * 5. Skip generation when insufficient messages
 * 6. Prevent duplicate generation
 * 7. Error handling and retry logic
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { useTitleGeneration } from "./use-title-generation";

// Mock Next.js router
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: vi.fn(),
		push: vi.fn(),
	}),
}));

// Import the mocked router function
import { useRouter } from "next/navigation";

// Mock API client
vi.mock("@/lib/api-client", () => ({
	generateTitleFromUserMessage: vi.fn(({ chatId, message }) =>
		Promise.resolve({
			success: true,
			title: `Generated: ${message.slice(0, 20)}...`,
		}),
	),
}));

// Import the mocked function
import { generateTitleFromUserMessage } from "@/lib/api-client";
const generateTitleMock = vi.mocked(generateTitleFromUserMessage);

describe("useTitleGeneration - Initialization", () => {
	it("initializes without errors", () => {
		const { result } = renderHook(() =>
			useTitleGeneration({
				chatId: "test-chat-1",
				isReadonly: false,
				messages: [],
			}),
		);

		expect(result.current).toBeUndefined();
	});

	it("handles missing chatId gracefully", () => {
		const { result } = renderHook(() =>
			useTitleGeneration({
				chatId: "",
				isReadonly: false,
				messages: [],
			}),
		);

		expect(result.current).toBeUndefined();
	});
});

describe("useTitleGeneration - Trigger Conditions", () => {
	it("does not generate title for readonly chats", async () => {

		const messages: UIMessage[] = [
			{
				role: "user",
				parts: [{ type: "text", text: "Hello world" }],
			},
			{
				role: "assistant",
				parts: [{ type: "text", text: "Hi there!" }],
			},
		];

		renderHook(() =>
			useTitleGeneration({
				chatId: "test-chat-2",
				isReadonly: true,
				messages,
			}),
		);

		await waitFor(() => {
			expect(generateTitleMock).not.toHaveBeenCalled();
		});
	});

	it("does not generate title with less than 2 messages", () => {

		const messages: UIMessage[] = [
			{
				role: "user",
				parts: [{ type: "text", text: "Only user message" }],
			},
		];

		renderHook(() =>
			useTitleGeneration({
				chatId: "test-chat-3",
				isReadonly: false,
				messages,
			}),
		);

		expect(generateTitleMock).not.toHaveBeenCalled();
	});

	it("does not generate title with empty messages array", () => {

		renderHook(() =>
			useTitleGeneration({
				chatId: "test-chat-4",
				isReadonly: false,
				messages: [],
			}),
		);

		expect(generateTitleMock).not.toHaveBeenCalled();
	});
});

describe("useTitleGeneration - Title Generation", () => {
	it("generates title when messages reach 2", async () => {

		const { rerender } = renderHook(
			({ messages }) =>
				useTitleGeneration({
					chatId: "test-chat-5",
					isReadonly: false,
					messages,
				}),
			{
				initialProps: {
					messages: [
						{
							role: "user",
							parts: [{ type: "text", text: "First message" }],
						},
					] as UIMessage[],
				},
			},
		);

		// Initially only 1 message
		expect(generateTitleMock).not.toHaveBeenCalled();

		// Add second message
		const messagesWithTwo: UIMessage[] = [
			{
				role: "user",
				parts: [{ type: "text", text: "First message" }],
			},
			{
				role: "assistant",
				parts: [{ type: "text", text: "Response" }],
			},
		];

		rerender({ messages: messagesWithTwo });

		await waitFor(() => {
			expect(generateTitleMock).toHaveBeenCalledWith({
				chatId: "test-chat-5",
				message: "First message",
			});
		});
	});

	it("extracts text from first user message", async () => {

		const messages: UIMessage[] = [
			{
				role: "user",
				parts: [{ type: "text", text: "This is my question about React hooks" }],
			},
			{
				role: "assistant",
				parts: [{ type: "text", text: "Let me help you with that" }],
			},
		];

		renderHook(() =>
			useTitleGeneration({
				chatId: "test-chat-6",
				isReadonly: false,
				messages,
			}),
		);

		await waitFor(() => {
			expect(generateTitleMock).toHaveBeenCalledWith({
				chatId: "test-chat-6",
				message: "This is my question about React hooks",
			});
		});
	});

	it("refreshes router after successful generation", async () => {
		const routerMock = vi.mocked(useRouter());

		const messages: UIMessage[] = [
			{
				role: "user",
				parts: [{ type: "text", text: "Test message" }],
			},
			{
				role: "assistant",
				parts: [{ type: "text", text: "Response" }],
			},
		];

		renderHook(() =>
			useTitleGeneration({
				chatId: "test-chat-7",
				isReadonly: false,
				messages,
			}),
		);

		await waitFor(() => {
			expect(routerMock.refresh).toHaveBeenCalled();
		});
	});
});

describe("useTitleGeneration - Duplicate Prevention", () => {
	it("prevents duplicate title generation with ref", async () => {

		const { rerender } = renderHook(
			({ messages }) =>
				useTitleGeneration({
					chatId: "test-chat-8",
					isReadonly: false,
					messages,
				}),
			{
				initialProps: {
					messages: [
						{
							role: "user",
							parts: [{ type: "text", text: "Initial message" }],
						},
					] as UIMessage[],
				},
			},
		);

		// Trigger generation by adding second message
		const messagesWithTwo: UIMessage[] = [
			{
				role: "user",
				parts: [{ type: "text", text: "Initial message" }],
			},
			{
				role: "assistant",
				parts: [{ type: "text", text: "Response" }],
			},
		];

		rerender({ messages: messagesWithTwo });

		await waitFor(() => {
			expect(generateTitleMock).toHaveBeenCalledTimes(1);
		});

		// Try to trigger again by re-rendering with same messages
		rerender({ messages: messagesWithTwo });

		// Should not call again
		expect(generateTitleMock).toHaveBeenCalledTimes(1);
	});

	it("does not generate title when first user message has no text part", async () => {

		const messages: UIMessage[] = [
			{
				role: "user",
				parts: [
					{
						type: "tool",
						toolCallId: "call-1",
						toolName: "search",
					},
				],
			},
			{
				role: "assistant",
				parts: [{ type: "text", text: "Response" }],
			},
		];

		renderHook(() =>
			useTitleGeneration({
				chatId: "test-chat-9",
				isReadonly: false,
				messages,
			}),
		);

		// Should not generate - no text part in user message
		expect(generateTitleMock).not.toHaveBeenCalled();
	});
});

describe("useTitleGeneration - Error Handling", () => {
	it("resets ref on failure to allow retry", async () => {
		generateTitleMock.mockRejectedValueOnce(
			new Error("Generation failed"),
		);

		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const { rerender } = renderHook(
			({ messages }) =>
				useTitleGeneration({
					chatId: "test-chat-10",
					isReadonly: false,
					messages,
				}),
			{
				initialProps: {
					messages: [
						{
							role: "user",
							parts: [{ type: "text", text: "Test" }],
						},
						{
							role: "assistant",
							parts: [{ type: "text", text: "Response" }],
						},
					] as UIMessage[],
				},
			},
		);

		await waitFor(() => {
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"[useTitleGeneration] Failed to generate title:",
				expect.any(Error),
			);
		});

		// After failure, ref should be reset - a new message could trigger retry
		const messagesWithThree: UIMessage[] = [
			{
				role: "user",
				parts: [{ type: "text", text: "Test" }],
			},
			{
				role: "assistant",
				parts: [{ type: "text", text: "Response" }],
			},
			{
				role: "user",
				parts: [{ type: "text", text: "Follow up" }],
			},
		];

		// Reset mock to succeed this time
		generateTitleMock.mockResolvedValueOnce({
			success: true,
			title: "Generated Title",
		});

		rerender({ messages: messagesWithThree });

		await waitFor(() => {
			expect(generateTitleMock).toHaveBeenCalled();
		});

		consoleWarnSpy.mockRestore();
	});
});

describe("useTitleGeneration - Edge Cases", () => {
	it("handles empty text in user message", async () => {

		const messages: UIMessage[] = [
			{
				role: "user",
				parts: [{ type: "text", text: "" }],
			},
			{
				role: "assistant",
				parts: [{ type: "text", text: "Response" }],
			},
		];

		renderHook(() =>
			useTitleGeneration({
				chatId: "test-chat-11",
				isReadonly: false,
				messages,
			}),
		);

		// Should not generate with empty text
		expect(generateTitleMock).not.toHaveBeenCalled();
	});

	it("handles messages without parts array", async () => {

		const messages: UIMessage[] = [
			{
				role: "user",
				parts: undefined as any,
			},
			{
				role: "assistant",
				parts: [{ type: "text", text: "Response" }],
			},
		];

		renderHook(() =>
			useTitleGeneration({
				chatId: "test-chat-12",
				isReadonly: false,
				messages,
			}),
		);

		// Should not generate when parts is undefined
		expect(generateTitleMock).not.toHaveBeenCalled();
	});
});
