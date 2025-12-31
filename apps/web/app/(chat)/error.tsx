"use client";

import { Home, MessageSquare, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ChatError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log the error with chat context
		console.error("[Chat Error]", {
			message: error.message,
			digest: error.digest,
			stack: error.stack,
		});
	}, [error]);

	const handleNewChat = () => {
		window.location.href = "/";
	};

	return (
		<div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background p-6">
			<div className="flex flex-col items-center gap-4 text-center">
				<div className="flex size-20 items-center justify-center rounded-full bg-destructive/10">
					<MessageSquare className="size-10 text-destructive" />
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-semibold text-foreground">Chat Error</h1>
					<p className="max-w-md text-sm text-muted-foreground">
						There was a problem loading the chat. Your messages are safe and you
						can try reloading or starting a new conversation.
					</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-center gap-3">
				<Button onClick={() => reset()} variant="default">
					<RefreshCw className="mr-2 size-4" />
					Try again
				</Button>
				<Button onClick={handleNewChat} variant="outline">
					<MessageSquare className="mr-2 size-4" />
					New chat
				</Button>
				<Button asChild variant="ghost">
					<a href="/">
						<Home className="mr-2 size-4" />
						Home
					</a>
				</Button>
			</div>

			{error.digest && (
				<p className="text-xs text-muted-foreground">
					Error ID: {error.digest}
				</p>
			)}
		</div>
	);
}
