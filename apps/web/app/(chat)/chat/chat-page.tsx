"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";

import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import type { VisibilityType } from "@/components/visibility-selector";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";

type ChatData = {
	id: string;
	title: string;
	visibility: VisibilityType;
	createdAt: Date;
	messages: ChatMessage[];
	isReadonly: boolean;
};

// Typed fetcher for chat data
const chatFetcher = async (url: string): Promise<ChatData> => {
	const response = await fetch(url);

	if (!response.ok) {
		const { code, cause } = (await response.json()) as {
			code: string;
			cause: string;
		};
		throw new ChatSDKError(code as any, cause);
	}

	return response.json() as Promise<ChatData>;
};

export function ChatPage() {
	const searchParams = useSearchParams();
	const chatId = searchParams.get("id");

	// Fetch chat metadata and messages
	const { data: chatData, error } = useSWR(
		chatId ? `/api/chat/${chatId}` : null,
		chatFetcher,
		{
			revalidateOnFocus: false,
			shouldRetryOnError: false,
		},
	);

	// Handle 404 or redirect cases
	useEffect(() => {
		if (error) {
			const status = (error as any)?.status;
			if (status === 401) {
				window.location.href = "/api/auth/guest";
				return;
			}
			if (status === 404 || status === 403) {
				window.location.href = "/";
				return;
			}
		}
	}, [error]);

	// Show loading state
	if (!chatData) {
		if (chatId) {
			return (
				<div className="flex h-dvh items-center justify-center">Loading...</div>
			);
		}
		// No chat ID - show empty/new chat state
		return (
			<>
				<Chat
					autoResume={false}
					id=""
					initialChatModel={searchParams.get("model") ?? DEFAULT_CHAT_MODEL}
					initialMessages={[]}
					initialVisibilityType="private"
					isReadonly={false}
				/>
				<DataStreamHandler />
			</>
		);
	}

	return (
		<>
			<Chat
				autoResume={true}
				id={chatData.id}
				initialChatModel={searchParams.get("model") ?? DEFAULT_CHAT_MODEL}
				initialMessages={chatData.messages}
				initialVisibilityType={chatData.visibility}
				isReadonly={chatData.isReadonly}
			/>
			<DataStreamHandler />
		</>
	);
}
