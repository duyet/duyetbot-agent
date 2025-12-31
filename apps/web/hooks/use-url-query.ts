import type { UseChatHelpers } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";

interface UseURLQueryOptions {
	chatId: string;
	sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
}

/**
 * Hook for handling URL query parameters to auto-send messages.
 * When a ?query= parameter is present in the URL, it sends that message
 * automatically and cleans up the URL.
 */
export function useURLQuery({ chatId, sendMessage }: UseURLQueryOptions) {
	const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

	useEffect(() => {
		// Get query parameter from URL
		const searchParams = new URLSearchParams(window.location.search);
		const query = searchParams.get("query");

		if (query && !hasAppendedQuery) {
			// Send the query as a message
			sendMessage({
				role: "user" as const,
				parts: [{ type: "text" as const, text: query }],
			});

			setHasAppendedQuery(true);

			// Clean up URL by removing query parameter
			const newUrl = `${window.location.pathname}`;
			window.history.replaceState({}, "", newUrl);
		}
	}, [hasAppendedQuery, sendMessage]);

	return hasAppendedQuery;
}
