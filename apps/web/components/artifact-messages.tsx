import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import type { UIArtifact } from "./artifact";
import { PreviewMessage, ThinkingMessage } from "./message";

type ArtifactMessagesProps = {
	addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
	chatId: string;
	status: UseChatHelpers<ChatMessage>["status"];
	votes: Vote[] | undefined;
	messages: ChatMessage[];
	setMessages: UseChatHelpers<ChatMessage>["setMessages"];
	regenerate: UseChatHelpers<ChatMessage>["regenerate"];
	isReadonly: boolean;
	artifactStatus: UIArtifact["status"];
};

function PureArtifactMessages({
	addToolApprovalResponse,
	chatId,
	status,
	votes,
	messages,
	setMessages,
	regenerate,
	isReadonly,
}: ArtifactMessagesProps) {
	const {
		containerRef: messagesContainerRef,
		endRef: messagesEndRef,
		onViewportEnter,
		onViewportLeave,
		hasSentMessage,
	} = useMessages({
		status,
	});

	// Arrow key navigation state
	const [focusedMessageIndex, setFocusedMessageIndex] = useState<number | null>(
		null,
	);
	const messageRefs = useRef<Map<string, HTMLElement>>(new Map());

	// Handle arrow key navigation
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			// Only handle arrow keys when not in an input/textarea
			const target = event.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			) {
				return;
			}

			// Ignore if no messages
			if (messages.length === 0) return;

			// Handle arrow keys
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();

				if (event.key === "ArrowDown") {
					// Move to next message or clear focus if at bottom
					if (focusedMessageIndex === null) {
						setFocusedMessageIndex(0);
					} else if (focusedMessageIndex < messages.length - 1) {
						setFocusedMessageIndex(focusedMessageIndex + 1);
					} else {
						setFocusedMessageIndex(null); // Clear focus at bottom
					}
				} else if (event.key === "ArrowUp") {
					// Move to previous message
					if (focusedMessageIndex === null) {
						setFocusedMessageIndex(messages.length - 1);
					} else if (focusedMessageIndex > 0) {
						setFocusedMessageIndex(focusedMessageIndex - 1);
					}
				}
			} else if (event.key === "Escape") {
				// Clear focus on Escape
				setFocusedMessageIndex(null);
			}
		},
		[messages.length, focusedMessageIndex],
	);

	// Register keyboard event listener
	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	// Scroll focused message into view
	useEffect(() => {
		if (focusedMessageIndex === null) return;

		const messageId = messages[focusedMessageIndex]?.id;
		if (!messageId) return;

		const element = messageRefs.current.get(messageId);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "nearest" });
			// Add visual focus indicator
			element.setAttribute("data-focused", "true");
		}

		// Remove focus indicator from previously focused messages
		messageRefs.current.forEach((el, id) => {
			if (id !== messageId) {
				el.removeAttribute("data-focused");
			}
		});
	}, [focusedMessageIndex, messages]);

	// Register message ref callback
	const registerMessageRef = useCallback(
		(messageId: string) => (element: HTMLElement | null) => {
			if (element) {
				messageRefs.current.set(messageId, element);
			} else {
				messageRefs.current.delete(messageId);
			}
		},
		[],
	);

	// Reset focus when messages change significantly
	useEffect(() => {
		setFocusedMessageIndex(null);
		// Clear old message refs that are no longer in the list
		const currentIds = new Set(messages.map((m) => m.id));
		messageRefs.current.forEach((_, id) => {
			if (!currentIds.has(id)) {
				messageRefs.current.delete(id);
			}
		});
	}, [messages]);

	return (
		<div
			className="flex h-full flex-col items-center gap-4 overflow-y-scroll px-4 pt-20"
			ref={messagesContainerRef}
		>
			{messages.map((message, index) => (
				<div
					className="w-full rounded-md transition-colors [&[data-focused=true]]:bg-muted/50"
					key={message.id}
					ref={registerMessageRef(message.id)}
				>
					<PreviewMessage
						addToolApprovalResponse={addToolApprovalResponse}
						chatId={chatId}
						isLoading={status === "streaming" && index === messages.length - 1}
						isReadonly={isReadonly}
						message={message}
						regenerate={regenerate}
						requiresScrollPadding={
							hasSentMessage && index === messages.length - 1
						}
						setMessages={setMessages}
						vote={
							votes
								? votes.find((vote) => vote.messageId === message.id)
								: undefined
						}
					/>
				</div>
			))}

			<AnimatePresence mode="wait">
				{status === "submitted" &&
					!messages.some((msg) =>
						msg.parts?.some(
							(part) => "state" in part && part.state === "approval-responded",
						),
					) && <ThinkingMessage key="thinking" />}
			</AnimatePresence>

			<motion.div
				className="min-h-[24px] min-w-[24px] shrink-0"
				onViewportEnter={onViewportEnter}
				onViewportLeave={onViewportLeave}
				ref={messagesEndRef}
			/>
		</div>
	);
}

function areEqual(
	prevProps: ArtifactMessagesProps,
	nextProps: ArtifactMessagesProps,
) {
	if (
		prevProps.artifactStatus === "streaming" &&
		nextProps.artifactStatus === "streaming"
	) {
		return true;
	}

	if (prevProps.status !== nextProps.status) {
		return false;
	}
	if (prevProps.status && nextProps.status) {
		return false;
	}
	if (prevProps.messages.length !== nextProps.messages.length) {
		return false;
	}
	if (!equal(prevProps.votes, nextProps.votes)) {
		return false;
	}

	return true;
}

export const ArtifactMessages = memo(PureArtifactMessages, areEqual);
