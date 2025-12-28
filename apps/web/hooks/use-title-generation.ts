import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/lib/types";
import { generateTitleFromUserMessage } from "@/lib/api-client";

interface UseTitleGenerationOptions {
	chatId: string;
	isReadonly: boolean;
	messages: UIMessage[];
}

/**
 * Hook for auto-generating chat titles after the first message.
 * Generates a title from the first user message after the first response completes.
 * Uses a ref to track if generation was already attempted to prevent duplicates.
 */
export function useTitleGeneration({
	chatId,
	isReadonly,
	messages,
}: UseTitleGenerationOptions) {
	const router = useRouter();
	const titleGeneratedRef = useRef(false);

	useEffect(() => {
		// Only generate title for non-readonly chats with at least 2 messages (user + assistant)
		if (titleGeneratedRef.current || isReadonly || messages.length < 2) {
			return;
		}

		// Find the first user message to generate title from
		const firstUserMessage = messages.find((m) => m.role === "user");
		const textPart = firstUserMessage?.parts?.find((p) => p.type === "text");
		const messageText = textPart && "text" in textPart ? textPart.text : "";

		if (!messageText) {
			return;
		}

		// Mark as attempted before async call to prevent duplicates
		titleGeneratedRef.current = true;

		// Generate title asynchronously
		generateTitleFromUserMessage({
			chatId,
			message: messageText,
		})
			.then(() => {
				// Refresh the sidebar to show updated title
				router.refresh();
			})
			.catch((error) => {
				console.warn("[useTitleGeneration] Failed to generate title:", error);
				// Reset ref on failure so we can retry
				titleGeneratedRef.current = false;
			});
	}, [messages.length, chatId, isReadonly, router]);
}
