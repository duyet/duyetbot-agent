import { DefaultChatTransport } from "ai";
import type { RefObject } from "react";
import type { VisibilityType } from "@/components/visibility-selector";
import {
	getAISettings,
	getEffectiveInstructions,
} from "@/lib/custom-instructions";
import { fetchWithErrorHandlers } from "@/lib/utils";

interface PrepareChatMessagesOptions {
	chatId: string;
	visibilityType: VisibilityType;
	currentModelIdRef: RefObject<string>;
}

/**
 * Prepares the chat transport with tool approval continuation detection
 * and AI settings inclusion.
 */
export function createChatTransport({
	chatId,
	visibilityType,
	currentModelIdRef,
}: PrepareChatMessagesOptions) {
	return new DefaultChatTransport({
		api: "/api/chat",
		// Cast to typeof fetch since fetchWithErrorHandlers is compatible but missing unused preconnect method
		fetch: fetchWithErrorHandlers as typeof fetch,
		prepareSendMessagesRequest(request) {
			const lastMessage = request.messages.at(-1);

			// Check if this is a tool approval continuation:
			// - Last message is NOT a user message (meaning no new user input)
			// - OR any message has tool parts that were responded to (approved or denied)
			const isToolApprovalContinuation =
				lastMessage?.role !== "user" ||
				request.messages.some((msg) =>
					msg.parts?.some((part) => {
						const state = (part as { state?: string }).state;
						return state === "approval-responded" || state === "output-denied";
					}),
				);

			// Get custom instructions and AI settings
			const customInstructions = getEffectiveInstructions(chatId);
			const aiSettings = getAISettings();

			return {
				body: {
					id: request.id,
					// Send all messages for tool approval continuation, otherwise just the last user message
					...(isToolApprovalContinuation
						? { messages: request.messages }
						: { message: lastMessage }),
					selectedChatModel: currentModelIdRef.current,
					selectedVisibilityType: visibilityType,
					// Include custom instructions and AI settings
					...(customInstructions && { customInstructions }),
					...(aiSettings && {
						aiSettings: {
							...(aiSettings.temperature !== 0.7 && {
								temperature: aiSettings.temperature,
							}),
							...(aiSettings.maxTokens && {
								maxTokens: aiSettings.maxTokens,
							}),
							...(aiSettings.topP !== undefined && { topP: aiSettings.topP }),
							...(aiSettings.frequencyPenalty !== undefined && {
								frequencyPenalty: aiSettings.frequencyPenalty,
							}),
							...(aiSettings.presencePenalty !== undefined && {
								presencePenalty: aiSettings.presencePenalty,
							}),
						},
					}),
					...request.body,
				},
			};
		},
	});
}
