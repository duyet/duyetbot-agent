/**
 * VirtualizedMessages Component
 *
 * Implements virtual scrolling for message lists using react-window.
 * Only renders visible messages for better performance with long conversations.
 *
 * Features:
 * - VariableSizeList for messages with dynamic heights
 * - Preserves keyboard navigation (arrow keys, Escape)
 * - Preserves message focus management
 * - Preserves scroll-to-bottom functionality
 * - Preserves auto-read functionality
 * - Dynamic height tracking and caching
 */

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ListImperativeAPI } from "react-window";
import { List } from "react-window";
import React from "react";
import equal from "fast-deep-equal";
import { ArrowDownIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMessages } from "@/hooks/use-messages";
import { useSpeechSynthesis } from "@/hooks/use-text-to-speech";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { getVoiceOptions, useVoiceSettings } from "@/lib/voice-settings";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

// Inner item renderer for the virtual list
interface MessageItemProps {
	index: number;
	data: {
		messages: ChatMessage[];
		addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
		chatId: string;
		status: UseChatHelpers<ChatMessage>["status"];
		regenerate: UseChatHelpers<ChatMessage>["regenerate"];
		setMessages: UseChatHelpers<ChatMessage>["setMessages"];
		isReadonly: boolean;
		votes: Vote[] | undefined;
		registerMessageRef: (messageId: string, index: number) => (element: HTMLElement | null) => void;
		hasSentMessage: boolean;
	};
	style?: React.CSSProperties;
}

function MessageItem({ index, style, data }: MessageItemProps) {
	const message = data.messages[index];

	if (!message) {
		return null;
	}

	return (
		<div
			className="animate-slide-up-fade rounded-md transition-colors [&[data-focused=true]]:bg-muted/50"
			style={style}
			ref={data.registerMessageRef(message.id, index)}
		>
			<PreviewMessage
				addToolApprovalResponse={data.addToolApprovalResponse}
				chatId={data.chatId}
				isLoading={data.status === "streaming" && data.messages.length - 1 === index}
				isReadonly={data.isReadonly}
				message={message}
				regenerate={data.regenerate}
				requiresScrollPadding={data.hasSentMessage && index === data.messages.length - 1}
				setMessages={data.setMessages}
				vote={
					data.votes ? data.votes.find((vote) => vote.messageId === message.id) : undefined
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
	const [focusedMessageIndex, setFocusedMessageIndex] = useState<number | null>(null);
	const messageRefs = useRef<Map<string, HTMLElement>>(new Map());

	// Virtual list ref
	const listRef = useRef<ListImperativeAPI | null>(null);

	// Height cache for variable size list
	const heightCache = useRef<Map<number, number>>(new Map());
	const [containerHeight, setContainerHeight] = useState(0);
	const resizeObserversRef = useRef<Map<number, ResizeObserver>>(new Map());

	// Measure container height
	const containerMeasureRef = useCallback((element: HTMLElement | null) => {
		if (element) {
			setContainerHeight(element.offsetHeight);
			// Also set the messagesContainerRef for useMessages hook
			if (messagesContainerRef) {
				(messagesContainerRef as React.MutableRefObject<HTMLElement | null>).current =
					element;
			}
		}
	}, []);

	// Auto-read functionality
	const { speak, isSupported } = useSpeechSynthesis();
	const { settings: voiceSettings } = useVoiceSettings();
	const prevStatusRef = useRef(status);
	const lastReadMessageIdRef = useRef<string | null>(null);

	// Get item size for virtual list
	const getItemSize = useCallback((index: number) => {
		// Return cached height if available
		if (heightCache.current.has(index)) {
			return heightCache.current.get(index)!;
		}

		// Estimate height based on message content
		const message = messages[index];
		if (!message) return 100;

		// Base height + estimate based on content length
		const baseHeight = 80;
		const contentLength =
			message.parts
				?.filter((part) => part.type === "text")
				.map((part) => ("text" in part ? part.text : "").length)
				.reduce((a, b) => a + b, 0) || 0;

		// Add spacing (gap-4 = 16px)
		const estimatedHeight = baseHeight + Math.min(contentLength / 10, 500) + 16;
		return estimatedHeight;
	}, [messages]);

	// Reset height cache when messages change significantly
	useEffect(() => {
		heightCache.current.clear();
		// Clean up old ResizeObservers
		resizeObserversRef.current.forEach((observer) => observer.disconnect());
		resizeObserversRef.current.clear();
		// Clear old message refs
		const currentIds = new Set(messages.map((m) => m.id));
		messageRefs.current.forEach((_, id) => {
			if (!currentIds.has(id)) {
				messageRefs.current.delete(id);
			}
		});

		// Cleanup on unmount
		return () => {
			resizeObserversRef.current.forEach((observer) => observer.disconnect());
			resizeObserversRef.current.clear();
		};
	}, [messages]);

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

	// Scroll focused message into view
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

	// Register message ref callback with height measurement
	const registerMessageRef = useCallback(
		(messageId: string, index: number) => (element: HTMLElement | null) => {
			if (element) {
				messageRefs.current.set(messageId, element);

				// Set up ResizeObserver to track height changes
				if (!resizeObserversRef.current.has(index)) {
					const resizeObserver = new ResizeObserver((entries) => {
						for (const entry of entries) {
							const newHeight = entry.contentRect.height;
							if (newHeight > 0) {
								const oldHeight = heightCache.current.get(index) || 0;
								// Only update if height changed significantly (>5px)
								if (Math.abs(newHeight - oldHeight) > 5) {
									heightCache.current.set(index, newHeight);
									// Force re-render by updating the cache
									// The list will recalculate when getItemSize is called again
								}
							}
						}
					});

					resizeObserver.observe(element);
					resizeObserversRef.current.set(index, resizeObserver);

					// Initial height measurement
					const initialHeight = element.offsetHeight;
					if (initialHeight > 0) {
						heightCache.current.set(index, initialHeight);
					}
				}
			} else {
				messageRefs.current.delete(messageId);

				// Clean up ResizeObserver
				const observer = resizeObserversRef.current.get(index);
				if (observer) {
					observer.disconnect();
					resizeObserversRef.current.delete(index);
				}
				heightCache.current.delete(index);
			}
		},
		[],
	);

	// Auto-read effect
	useEffect(() => {
		const wasStreaming = prevStatusRef.current === "streaming";
		const isNowReady = status === "ready";
		prevStatusRef.current = status;

		if (!wasStreaming || !isNowReady) return;
		if (!isSupported || !voiceSettings.enabled || !voiceSettings.autoRead) return;
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
		if (hasSentMessage && isAtBottom && messages.length > 0) {
			listRef.current?.scrollToRow({
				index: messages.length - 1,
				align: "end",
				behavior: "auto",
			});
		}
	}, [messages.length, hasSentMessage, isAtBottom]);

	// Memoize item data to prevent unnecessary re-renders
	const itemData = useMemo(
		() => ({
			messages,
			addToolApprovalResponse,
			chatId,
			status,
			regenerate,
			setMessages,
			isReadonly,
			votes,
			registerMessageRef,
			hasSentMessage,
		}),
		[
			messages,
			addToolApprovalResponse,
			chatId,
			status,
			regenerate,
			setMessages,
			isReadonly,
			votes,
			registerMessageRef,
			hasSentMessage,
		],
	);

	const itemCount = messages.length + 1; // +1 for the end ref spacer

	return (
		<div className="relative flex-1">
			<div
				className="absolute inset-0 touch-pan-y overflow-hidden"
				ref={containerMeasureRef}
			>
				{containerHeight > 0 && (
					<>
						{messages.length === 0 ? (
							<div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 px-3 py-4 sm:px-4 md:gap-6 md:px-6 lg:px-8">
								<Greeting />
							</div>
						) : (
							<div className="mx-auto flex min-w-0 max-w-4xl flex-col px-3 py-4 sm:px-4 md:px-6 lg:px-8">
								{React.createElement(
									List as any,
									{
										ref: listRef,
										height: containerHeight,
										rowCount: itemCount,
										rowHeight: getItemSize,
										rowProps: itemData,
										width: "100%",
										overscanCount: 3,
									},
									(({ index, style, data }: MessageItemProps) => (
										<MessageItem index={index} style={style} data={data} />
									)) as any,
								)}

								{status === "submitted" &&
									!messages.some((msg) =>
										msg.parts?.some(
											(part) =>
												"state" in part && part.state === "approval-responded",
										),
									) && <ThinkingMessage />}
							</div>
						)}

						<div
							className="min-h-[24px] min-w-[24px] shrink-0"
							ref={messagesEndRef}
						/>
					</>
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

export const VirtualizedMessages = memo(PureVirtualizedMessages, (prevProps, nextProps) => {
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
