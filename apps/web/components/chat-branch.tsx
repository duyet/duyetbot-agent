"use client";

import { GitBranch, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type ChatBranchProps = {
	chatId: string;
	messageId?: string; // Optional: branch from specific message
	onBranch?: (newChatId: string) => void;
};

export function ChatBranch({ chatId, messageId, onBranch }: ChatBranchProps) {
	const [isBranching, setIsBranching] = useState(false);
	const router = useRouter();

	const handleBranch = async () => {
		setIsBranching(true);
		try {
			const response = await fetch("/api/chat/branch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ chatId, messageId }),
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { message?: string };
				throw new Error(errorData.message || "Failed to branch chat");
			}

			const data = (await response.json()) as {
				newChatId: string;
				messageCount: number;
			};

			toast.success(`Branch created with ${data.messageCount} messages`);
			onBranch?.(data.newChatId);

			// Navigate to the new branched chat
			router.push(`/chat/${data.newChatId}`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to branch chat",
			);
			console.error(error);
		} finally {
			setIsBranching(false);
		}
	};

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
					data-testid="branch-button"
					disabled={isBranching}
					onClick={handleBranch}
					size="icon"
					variant="ghost"
				>
					{isBranching ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<GitBranch className="h-4 w-4" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				{messageId ? "Branch from this message" : "Branch entire chat"}
			</TooltipContent>
		</Tooltip>
	);
}
