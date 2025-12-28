import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { memo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useCopyToClipboard } from "usehooks-ts";
import { deleteMessage } from "@/lib/api-client";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { ChatBranch } from "./chat-branch";
import { Action, Actions } from "./elements/actions";
import {
	CopyIcon,
	PencilEditIcon,
	ThumbDownIcon,
	ThumbUpIcon,
	TrashIcon,
} from "./icons";
import { getChatHistoryPaginationKey } from "./sidebar-history";

export function PureMessageActions({
	chatId,
	message,
	vote,
	isLoading,
	setMode,
	setMessages,
}: {
	chatId: string;
	message: ChatMessage;
	vote: Vote | undefined;
	isLoading: boolean;
	setMode?: (mode: "view" | "edit") => void;
	setMessages?: UseChatHelpers<ChatMessage>["setMessages"];
}) {
	const { mutate } = useSWRConfig();
	const [_, copyToClipboard] = useCopyToClipboard();
	const [isDeleting, setIsDeleting] = useState(false);

	if (isLoading) {
		return null;
	}

	const handleDelete = async () => {
		if (!setMessages) {
			return;
		}

		setIsDeleting(true);
		try {
			await deleteMessage({ id: message.id });

			// Remove the message from local state
			setMessages((messages) => messages.filter((m) => m.id !== message.id));

			// Refresh sidebar in case this was the last message
			mutate(unstable_serialize(getChatHistoryPaginationKey));

			toast.success("Message deleted");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete message",
			);
		} finally {
			setIsDeleting(false);
		}
	};

	const textFromParts = message.parts
		?.filter((part) => part.type === "text")
		.map((part) => ("text" in part ? part.text : ""))
		.join("\n")
		.trim();

	const handleCopy = async () => {
		if (!textFromParts) {
			toast.error("There's no text to copy!");
			return;
		}

		await copyToClipboard(textFromParts);
		toast.success("Copied to clipboard!");
	};

	// User messages get edit, delete (on hover) and copy actions
	if (message.role === "user") {
		return (
			<Actions className="-mr-0.5 justify-end">
				<div className="relative flex items-center gap-1">
					{setMode && (
						<Action
							className="-left-10 absolute top-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100"
							data-testid="message-edit-button"
							onClick={() => setMode("edit")}
							tooltip="Edit"
						>
							<PencilEditIcon />
						</Action>
					)}
					{setMessages && (
						<Action
							className="-left-[72px] absolute top-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100"
							data-testid="message-delete-button"
							disabled={isDeleting}
							onClick={handleDelete}
							tooltip="Delete"
						>
							<TrashIcon size={14} />
						</Action>
					)}
					<Action onClick={handleCopy} tooltip="Copy">
						<CopyIcon />
					</Action>
				</div>
			</Actions>
		);
	}

	return (
		<Actions className="-ml-0.5">
			<Action onClick={handleCopy} tooltip="Copy">
				<CopyIcon />
			</Action>

			<Action
				data-testid="message-upvote"
				disabled={vote?.isUpvoted}
				onClick={() => {
					const upvote = async () => {
						const response = await fetch("/api/vote", {
							method: "PATCH",
							body: JSON.stringify({
								chatId,
								messageId: message.id,
								type: "up",
							}),
						});
						if (!response.ok) {
							throw new Error("Failed to upvote");
						}
						return response;
					};

					toast.promise(upvote(), {
						loading: "Upvoting Response...",
						success: () => {
							mutate<Vote[]>(
								`/api/vote?chatId=${chatId}`,
								(currentVotes) => {
									if (!currentVotes) {
										return [];
									}

									const votesWithoutCurrent = currentVotes.filter(
										(currentVote) => currentVote.messageId !== message.id,
									);

									return [
										...votesWithoutCurrent,
										{
											chatId,
											messageId: message.id,
											isUpvoted: true,
										},
									];
								},
								{ revalidate: false },
							);

							return "Upvoted Response!";
						},
						error: "Failed to upvote response.",
					});
				}}
				tooltip="Upvote Response"
			>
				<ThumbUpIcon />
			</Action>

			<Action
				data-testid="message-downvote"
				disabled={vote && !vote.isUpvoted}
				onClick={() => {
					const downvote = async () => {
						const response = await fetch("/api/vote", {
							method: "PATCH",
							body: JSON.stringify({
								chatId,
								messageId: message.id,
								type: "down",
							}),
						});
						if (!response.ok) {
							throw new Error("Failed to downvote");
						}
						return response;
					};

					toast.promise(downvote(), {
						loading: "Downvoting Response...",
						success: () => {
							mutate<Vote[]>(
								`/api/vote?chatId=${chatId}`,
								(currentVotes) => {
									if (!currentVotes) {
										return [];
									}

									const votesWithoutCurrent = currentVotes.filter(
										(currentVote) => currentVote.messageId !== message.id,
									);

									return [
										...votesWithoutCurrent,
										{
											chatId,
											messageId: message.id,
											isUpvoted: false,
										},
									];
								},
								{ revalidate: false },
							);

							return "Downvoted Response!";
						},
						error: "Failed to downvote response.",
					});
				}}
				tooltip="Downvote Response"
			>
				<ThumbDownIcon />
			</Action>

			<ChatBranch chatId={chatId} messageId={message.id} />
		</Actions>
	);
}

export const MessageActions = memo(
	PureMessageActions,
	(prevProps, nextProps) => {
		if (!equal(prevProps.vote, nextProps.vote)) {
			return false;
		}
		if (prevProps.isLoading !== nextProps.isLoading) {
			return false;
		}

		return true;
	},
);
