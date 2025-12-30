import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { memo } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { PureMessages } from "./messages-inner";
import { VirtualizedMessages } from "./virtualized-messages";

// Threshold for switching to virtual scrolling (50+ messages)
const VIRTUAL_SCROLL_THRESHOLD = 50;

type MessagesProps = {
	addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
	chatId: string;
	status: UseChatHelpers<ChatMessage>["status"];
	votes: Vote[] | undefined;
	messages: ChatMessage[];
	setMessages: UseChatHelpers<ChatMessage>["setMessages"];
	regenerate: UseChatHelpers<ChatMessage>["regenerate"];
	isReadonly: boolean;
	isArtifactVisible: boolean;
	selectedModelId: string;
};

/**
 * Messages component with automatic virtual scrolling for long conversations.
 *
 * Uses standard rendering for chats with <50 messages, and switches to
 * virtual scrolling for 50+ messages to maintain performance.
 */
export function Messages(props: MessagesProps) {
	const { messages } = props;

	// Use virtual scrolling for long conversations
	if (messages.length >= VIRTUAL_SCROLL_THRESHOLD) {
		return <VirtualizedMessages {...props} />;
	}

	// Use standard rendering for shorter conversations
	return <PureMessages {...props} />;
}

export const MessagesMemo = memo(Messages, (prevProps, nextProps) => {
	if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) {
		return true;
	}

	if (prevProps.status !== nextProps.status) {
		return false;
	}
	if (prevProps.selectedModelId !== nextProps.selectedModelId) {
		return false;
	}
	if (prevProps.messages.length !== nextProps.messages.length) {
		return false;
	}
	if (!equal(prevProps.messages, nextProps.messages)) {
		return false;
	}
	if (!equal(prevProps.votes, nextProps.votes)) {
		return false;
	}

	return false;
});
