"use client";

import { useRouter } from "next/navigation";
import { memo } from "react";
import { useWindowSize } from "usehooks-ts";
import { ChatExport } from "@/components/chat-export";
import {
	ConnectionStatusIndicator,
	mapStatusToConnectionStatus,
} from "@/components/connection-status";
import { ContextWindowIndicator } from "@/components/context-window-indicator";
import { GuestUsageIndicator } from "@/components/guest-usage-indicator";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/types";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

type ChatStatus =
	| "ready"
	| "pending"
	| "streaming"
	| "error"
	| "submitted"
	| "done"
	| undefined;

function PureChatHeader({
	chatId,
	chatTitle,
	messages,
	selectedVisibilityType,
	selectedChatModel,
	isReadonly,
	status,
	isOnline,
}: {
	chatId: string;
	chatTitle?: string;
	messages?: ChatMessage[];
	selectedVisibilityType: VisibilityType;
	selectedChatModel?: string;
	isReadonly: boolean;
	status?: ChatStatus;
	isOnline?: boolean;
}) {
	const router = useRouter();
	const { open } = useSidebar();

	const { width: windowWidth } = useWindowSize();

	const connectionStatus = mapStatusToConnectionStatus(
		status,
		isOnline ?? true,
	);

	return (
		<header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-2 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-2">
			<SidebarToggle />

			{(!open || windowWidth < 768) && (
				<Button
					className="order-2 ml-auto h-8 px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
					onClick={() => {
						router.push("/");
						router.refresh();
					}}
					variant="outline"
				>
					<PlusIcon />
					<span className="md:sr-only">New Chat</span>
				</Button>
			)}

			{!isReadonly && (
				<VisibilitySelector
					chatId={chatId}
					className="order-1 md:order-2"
					selectedVisibilityType={selectedVisibilityType}
				/>
			)}

			{/* Export button - only show when there are messages */}
			{messages && messages.length > 0 && (
				<div className="order-3">
					<ChatExport
						chatId={chatId}
						chatTitle={chatTitle || "Chat"}
						messages={messages}
					/>
				</div>
			)}

			{/* Context window indicator - shows conversation size */}
			{messages && messages.length > 0 && selectedChatModel && (
				<div className="order-4">
					<ContextWindowIndicator
						messages={messages}
						modelId={selectedChatModel}
						variant="compact"
					/>
				</div>
			)}

			{/* Guest usage indicator - shows remaining messages for guests */}
			<div className="order-5 ml-auto md:ml-2">
				<GuestUsageIndicator variant="compact" />
			</div>

			{/* Connection status indicator */}
			<div className="order-6 md:ml-2">
				<ConnectionStatusIndicator
					status={connectionStatus}
					variant="compact"
				/>
			</div>
		</header>
	);
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
	return (
		prevProps.chatId === nextProps.chatId &&
		prevProps.chatTitle === nextProps.chatTitle &&
		prevProps.messages?.length === nextProps.messages?.length &&
		prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
		prevProps.selectedChatModel === nextProps.selectedChatModel &&
		prevProps.isReadonly === nextProps.isReadonly &&
		prevProps.status === nextProps.status &&
		prevProps.isOnline === nextProps.isOnline
	);
});
