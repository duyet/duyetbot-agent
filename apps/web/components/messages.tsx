import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { ArrowDownIcon } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useMessages } from "@/hooks/use-messages";
import { useSpeechSynthesis } from "@/hooks/use-text-to-speech";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { getVoiceOptions, useVoiceSettings } from "@/lib/voice-settings";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

// NOTE: VirtualizedMessages component is available for long conversations
// but currently disabled due to React 19 + react-window type compatibility issues.
// To enable for conversations with 50+ messages, uncomment the import and conditional render:
// import { VirtualizedMessages } from "./virtualized-messages";
// const VIRTUAL_SCROLL_THRESHOLD = 50;

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

function PureMessages({
	addToolApprovalResponse,
	chatId,
	status,
	votes,
	messages,
	setMessages,
	regenerate,
	isReadonly,
	selectedModelId: _selectedModelId,
}: MessagesProps) {
	const {
		containerRef: messagesContainerRef,
		endRef: messagesEndRef,
		isAtBottom,
		scrollToBottom,
		hasSentMessage,
	} = useMessages({
		status,
	});

	useDataStream();

	// Arrow key navigation state
	const [focusedMessageIndex, setFocusedMessageIndex] = useState<number | null>(
		null,
	);
	const messageRefs = useRef<Map<string, HTMLElement>>(new Map());

	// Auto-read functionality
	const { speak, isSupported } = useSpeechSynthesis();
	const { settings: voiceSettings } = useVoiceSettings();
	const prevStatusRef = useRef(status);
	const lastReadMessageIdRef = useRef<string | null>(null);

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

	useEffect(() => {
		// Check if status just changed from streaming to ready
		const wasStreaming = prevStatusRef.current === "streaming";
		const isNowReady = status === "ready";
		prevStatusRef.current = status;

		// Early return if auto-read conditions not met
		if (!wasStreaming || !isNowReady) return;
		if (!isSupported || !voiceSettings.enabled || !voiceSettings.autoRead)
			return;
		if (messages.length === 0) return;

		const lastMessage = messages[messages.length - 1];

		// Only read assistant messages
		if (lastMessage.role !== "assistant") return;

		// Prevent reading the same message twice
		if (lastReadMessageIdRef.current === lastMessage.id) return;
		lastReadMessageIdRef.current = lastMessage.id;

		// Extract text from message parts
		const textFromParts = lastMessage.parts
			?.filter((part) => part.type === "text")
			.map((part) => ("text" in part ? part.text : ""))
			.join("\n")
			.trim();

		if (textFromParts) {
			speak(textFromParts, getVoiceOptions(voiceSettings));
		}
	}, [status, messages, speak, isSupported, voiceSettings]);

	return (
		<div className="relative flex-1">
			<div
				className="absolute inset-0 touch-pan-y overflow-y-auto"
				ref={messagesContainerRef}
			>
				<div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 px-3 py-4 sm:px-4 md:gap-6 md:px-6 lg:px-8">
					{messages.length === 0 && <Greeting />}

					{messages.map((message, index) => (
						<div
							className="animate-slide-up-fade rounded-md transition-colors [&[data-focused=true]]:bg-muted/50"
							key={message.id}
							ref={registerMessageRef(message.id)}
							style={
								{
									"--stagger-index": Math.min(index, 5),
									animationDelay: `${Math.min(index, 5) * 50}ms`,
								} as React.CSSProperties
							}
						>
							<PreviewMessage
								addToolApprovalResponse={addToolApprovalResponse}
								chatId={chatId}
								isLoading={
									status === "streaming" && messages.length - 1 === index
								}
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

					{status === "submitted" &&
						!messages.some((msg) =>
							msg.parts?.some(
								(part) =>
									"state" in part && part.state === "approval-responded",
							),
						) && <ThinkingMessage />}

					<div
						className="min-h-[24px] min-w-[24px] shrink-0"
						ref={messagesEndRef}
					/>
				</div>
			</div>

			<button
				aria-label="Scroll to bottom"
				className={`-translate-x-1/2 absolute bottom-4 left-1/2 z-10 rounded-full border bg-background p-2 shadow-lg transition-all hover:bg-muted ${
					isAtBottom
						? "pointer-events-none scale-0 opacity-0"
						: "pointer-events-auto scale-100 opacity-100"
				}`}
				onClick={() => scrollToBottom("smooth")}
				type="button"
			>
				<ArrowDownIcon className="size-4" />
			</button>
		</div>
	);
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
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
