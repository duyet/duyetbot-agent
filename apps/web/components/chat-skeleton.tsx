"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Chat Skeleton - Full page loading skeleton for chat interface
 * Mimics the layout of the actual chat page for smooth loading transition
 */
export function ChatSkeleton() {
	return (
		<div className="flex h-dvh min-w-0 flex-col bg-background">
			{/* Header skeleton */}
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-2 py-1.5 backdrop-blur md:px-3">
				{/* Sidebar toggle */}
				<Skeleton className="h-8 w-8 rounded-md" />
				{/* New chat button */}
				<Skeleton className="h-8 w-24 rounded-md" />
				{/* Visibility selector */}
				<Skeleton className="h-8 w-20 rounded-md" />
				{/* Spacer */}
				<div className="ml-auto flex items-center gap-2">
					{/* Guest usage indicator */}
					<Skeleton className="h-6 w-16 rounded-md" />
					{/* Connection status */}
					<Skeleton className="h-6 w-6 rounded-full" />
				</div>
			</header>

			{/* Messages area skeleton */}
			<div className="flex-1 overflow-hidden">
				<div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center gap-6 px-4">
					{/* Greeting area skeleton */}
					<div className="flex flex-col items-center gap-4">
						{/* Logo/Avatar placeholder */}
						<Skeleton className="h-16 w-16 rounded-full" />
						{/* Greeting text */}
						<Skeleton className="h-8 w-64" />
						<Skeleton className="h-5 w-48" />
					</div>

					{/* Suggested actions skeleton */}
					<div className="grid w-full max-w-lg grid-cols-2 gap-3">
						<Skeleton className="h-16 rounded-lg" />
						<Skeleton className="h-16 rounded-lg" />
						<Skeleton className="h-16 rounded-lg" />
						<Skeleton className="h-16 rounded-lg" />
					</div>
				</div>
			</div>

			{/* Input area skeleton */}
			<div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 bg-background px-3 pb-3 sm:px-4 md:px-6 lg:px-8">
				<div className="flex w-full flex-col gap-2 rounded-2xl border bg-card p-2">
					{/* Textarea skeleton */}
					<Skeleton className="h-11 w-full rounded-xl" />
					{/* Toolbar skeleton */}
					<div className="flex items-center justify-between px-2">
						<div className="flex items-center gap-2">
							{/* Model selector */}
							<Skeleton className="h-8 w-36 rounded-md" />
							{/* Attachment button */}
							<Skeleton className="h-8 w-8 rounded-md" />
						</div>
						{/* Send button */}
						<Skeleton className="h-8 w-8 rounded-full" />
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Message Skeleton - Individual message loading skeleton
 * Can be used for lazy-loading individual messages
 */
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
	return (
		<div
			className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
		>
			{/* Avatar */}
			<Skeleton className="h-8 w-8 shrink-0 rounded-full" />
			{/* Message content */}
			<div
				className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
			>
				<Skeleton className={`h-5 ${isUser ? "w-32" : "w-48"} rounded-md`} />
				<Skeleton className={`h-16 ${isUser ? "w-48" : "w-72"} rounded-lg`} />
			</div>
		</div>
	);
}

/**
 * Messages List Skeleton - Multiple message placeholders
 */
export function MessagesListSkeleton({ count = 3 }: { count?: number }) {
	return (
		<div className="flex flex-col gap-6 p-4">
			{Array.from({ length: count }).map((_, i) => (
				<MessageSkeleton key={`skeleton-${i}`} isUser={i % 2 === 0} />
			))}
		</div>
	);
}

/**
 * Sidebar Skeleton - For lazy loading sidebar content
 */
export function SidebarSkeleton() {
	return (
		<div className="flex flex-col gap-4 p-4">
			{/* New chat button */}
			<Skeleton className="h-10 w-full rounded-lg" />

			{/* Section header */}
			<Skeleton className="h-4 w-16" />

			{/* Chat history items */}
			{Array.from({ length: 5 }).map((_, i) => (
				<Skeleton
					key={`sidebar-skeleton-${i}`}
					className="h-10 rounded-md"
					style={{ width: `${60 + Math.random() * 40}%` }}
				/>
			))}
		</div>
	);
}
