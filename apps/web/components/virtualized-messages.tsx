/**
 * VirtualizedMessages Component
 *
 * Implements virtual scrolling for message lists using react-virtuoso.
 * Only renders visible messages for better performance with long conversations.
 *
 * Features:
 * - VirtuosoList for messages with dynamic heights
 * - Preserves keyboard navigation (arrow keys, Escape)
 * - Preserves message focus management with smooth scrolling
 * - Preserves scroll-to-bottom functionality
 * - Preserves auto-read functionality
 * - Automatic height tracking (no manual cache needed)
 * - Better TypeScript compatibility with React 19
 */

import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { ArrowDownIcon } from "lucide-react";
import React, {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { Components as VirtuosoComponents } from "react-virtuoso";
import { Virtuoso } from "react-virtuoso";
import { useMessages } from "@/hooks/use-messages";
import { useSpeechSynthesis } from "@/hooks/use-text-to-speech";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { getVoiceOptions, useVoiceSettings } from "@/lib/voice-settings";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

// Message item renderer component
interface MessageItemProps {
	message: ChatMessage;
	index: number;
	addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
	chatId: string;
	status: UseChatHelpers<ChatMessage>["status"];
	regenerate: UseChatHelpers<ChatMessage>["regenerate"];
	setMessages: UseChatHelpers<ChatMessage>["setMessages"];
	isReadonly: boolean;
	votes: Vote[] | undefined;
	hasSentMessage: boolean;
	messagesLength: number;
	onMessageRef: (element: HTMLElement | null) => void;
}

function MessageItem({
	message,
	index,
	addToolApprovalResponse,
	chatId,
	status,
	regenerate,
	setMessages,
	isReadonly,
	votes,
	hasSentMessage,
	messagesLength,
	onMessageRef,
}: MessageItemProps) {
	return (
		<div
			className="animate-slide-up-fade rounded-md transition-colors [&[data-focused=true]]:bg-muted/50"
			ref={onMessageRef}
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
				isLoading={status === "streaming" && messagesLength - 1 === index}
				isReadonly={isReadonly}
				message={message}
				regenerate={regenerate}
				requiresScrollPadding={hasSentMessage && index === messagesLength - 1}
				setMessages={setMessages}
				vote={
					votes
						? votes.find((vote) => vote.messageId === message.id)
						: undefined
				}
			/>
		</div>
	);
}

type VirtualizedMessagesProps = {
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

function PureVirtualizedMessages({
	addToolApprovalResponse,
	chatId,
	status,
	votes,
	messages,
	setMessages,
	regenerate,
	isReadonly,
	selectedModelId: _selectedModelId,
}: VirtualizedMessagesProps) {
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
	const virtuosoRef = useRef<any>(null);

	// Auto-read functionality
	const { speak, isSupported } = useSpeechSynthesis();
	const { settings: voiceSettings } = useVoiceSettings();
	const prevStatusRef = useRef(status);
	const lastReadMessageIdRef = useRef<string | null>(null);

	// Handle arrow key navigation
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			const target = event.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			) {
				return;
			}

			if (messages.length === 0) return;

			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();

				if (event.key === "ArrowDown") {
					if (focusedMessageIndex === null) {
						setFocusedMessageIndex(0);
					} else if (focusedMessageIndex < messages.length - 1) {
						setFocusedMessageIndex(focusedMessageIndex + 1);
					} else {
						setFocusedMessageIndex(null);
					}
				} else if (event.key === "ArrowUp") {
					if (focusedMessageIndex === null) {
						setFocusedMessageIndex(messages.length - 1);
					} else if (focusedMessageIndex > 0) {
						setFocusedMessageIndex(focusedMessageIndex - 1);
					}
				}
			} else if (event.key === "Escape") {
				setFocusedMessageIndex(null);
			}
		},
		[messages.length, focusedMessageIndex],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	// Scroll focused message into view smoothly
	useEffect(() => {
		if (focusedMessageIndex === null) return;

		const messageId = messages[focusedMessageIndex]?.id;
		if (!messageId) return;

		const element = messageRefs.current.get(messageId);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "nearest" });
			element.setAttribute("data-focused", "true");
		}

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

	// Reset focus and clean up refs when messages change
	useEffect(() => {
		setFocusedMessageIndex(null);
		const currentIds = new Set(messages.map((m) => m.id));
		messageRefs.current.forEach((_, id) => {
			if (!currentIds.has(id)) {
				messageRefs.current.delete(id);
			}
		});
	}, [messages]);

	// Auto-read effect
	useEffect(() => {
		const wasStreaming = prevStatusRef.current === "streaming";
		const isNowReady = status === "ready";
		prevStatusRef.current = status;

		if (!wasStreaming || !isNowReady) return;
		if (!isSupported || !voiceSettings.enabled || !voiceSettings.autoRead)
			return;
		if (messages.length === 0) return;

		const lastMessage = messages[messages.length - 1];
		if (lastMessage.role !== "assistant") return;

		if (lastReadMessageIdRef.current === lastMessage.id) return;
		lastReadMessageIdRef.current = lastMessage.id;

		const textFromParts = lastMessage.parts
			?.filter((part) => part.type === "text")
			.map((part) => ("text" in part ? part.text : ""))
			.join("\n")
			.trim();

		if (textFromParts) {
			speak(textFromParts, getVoiceOptions(voiceSettings));
		}
	}, [status, messages, speak, isSupported, voiceSettings]);

	// Scroll to bottom when new messages arrive
	useEffect(() => {
		if (
			hasSentMessage &&
			isAtBottom &&
			messages.length > 0 &&
			virtuosoRef.current
		) {
			virtuosoRef.current.scrollToIndex({
				index: "LAST",
				behavior: "auto",
			});
		}
	}, [messages.length, hasSentMessage, isAtBottom]);

	// Memoize item content to prevent unnecessary re-renders
	const itemContent = useCallback(
		(index: number) => {
			const message = messages[index];
			if (!message) return null;

			return (
				<MessageItem
					message={message}
					index={index}
					addToolApprovalResponse={addToolApprovalResponse}
					chatId={chatId}
					status={status}
					regenerate={regenerate}
					setMessages={setMessages}
					isReadonly={isReadonly}
					votes={votes}
					hasSentMessage={hasSentMessage}
					messagesLength={messages.length}
					onMessageRef={registerMessageRef(message.id)}
				/>
			);
		},
		[
			messages,
			addToolApprovalResponse,
			chatId,
			status,
			regenerate,
			setMessages,
			isReadonly,
			votes,
			hasSentMessage,
			registerMessageRef,
		],
	);

	// Custom components for Virtuoso
	const components = useMemo<VirtuosoComponents>(
		() => ({
			// Empty state when no messages
			EmptyPlaceholder: () => (
				<div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 px-3 py-4 sm:px-4 md:gap-6 md:px-6 lg:px-8">
					<Greeting />
				</div>
			),
			// Scrollable container
			Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
				<div
					{...props}
					className="touch-pan-y overflow-y-auto"
					ref={(node) => {
						// Set both refs
						if (node) {
							(
								messagesContainerRef as React.MutableRefObject<HTMLElement | null>
							).current = node;
						}
						if (typeof ref === "function") {
							ref(node);
						} else if (ref) {
							ref.current = node;
						}
					}}
				/>
			)),
			// Item wrapper
			Item: ({ children, ...props }) => (
				<div
					{...props}
					className="mx-auto min-w-0 max-w-4xl px-3 py-2 sm:px-4 md:px-6 lg:px-8"
				>
					{children}
				</div>
			),
			// Footer with spacer and thinking message
			Foot: () => (
				<>
					{status === "submitted" &&
						!messages.some((msg) =>
							msg.parts?.some(
								(part) =>
									"state" in part && part.state === "approval-responded",
							),
						) && <ThinkingMessage />}
					<div
						ref={messagesEndRef}
						className="min-h-[24px] min-w-[24px] shrink-0"
					/>
				</>
			),
		}),
		[messagesContainerRef, status, messages, messagesEndRef],
	);

	return (
		<div className="relative flex-1">
			<div className="absolute inset-0">
				{messages.length === 0 ? (
					// Show greeting when no messages
					<div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 px-3 py-4 sm:px-4 md:gap-6 md:px-6 lg:px-8">
						<Greeting />
					</div>
				) : (
					// Virtualized list for messages
					<Virtuoso
						ref={virtuosoRef}
						style={{ height: "100%" }}
						data={messages}
						data-testid="virtualized-messages-list"
						itemContent={itemContent}
						components={components}
						overscan={200}
						defaultItemHeight={100}
						increaseViewportBy={{ top: 0, bottom: 200 }}
					/>
				)}
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

export const VirtualizedMessages = memo(
	PureVirtualizedMessages,
	(prevProps, nextProps) => {
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
	},
);
