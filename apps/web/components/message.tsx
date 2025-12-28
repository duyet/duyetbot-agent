"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { memo, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { DuyetMCPResults } from "./duyet-mcp-results";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "./elements/tool";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PlanVisualizer } from "./plan-visualizer";
import { PreviewAttachment } from "./preview-attachment";
import { ScratchpadViewer } from "./scratchpad-viewer";
import { SearchResults } from "./search-results";
import { type TokenUsage, TokenUsageDisplay } from "./token-usage-display";
import { TypingIndicator } from "./typing-indicator";
import { UrlFetchPreview } from "./url-fetch-preview";
import { Weather } from "./weather";

const PurePreviewMessage = ({
	addToolApprovalResponse,
	chatId,
	message,
	vote,
	isLoading,
	setMessages,
	regenerate,
	isReadonly,
	requiresScrollPadding: _requiresScrollPadding,
}: {
	addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
	chatId: string;
	message: ChatMessage;
	vote: Vote | undefined;
	isLoading: boolean;
	setMessages: UseChatHelpers<ChatMessage>["setMessages"];
	regenerate: UseChatHelpers<ChatMessage>["regenerate"];
	isReadonly: boolean;
	requiresScrollPadding: boolean;
}) => {
	const [mode, setMode] = useState<"view" | "edit">("view");

	const attachmentsFromMessage = message.parts.filter(
		(
			part,
		): part is {
			type: "file";
			url: string;
			filename?: string;
			mediaType: string;
		} => part.type === "file",
	);

	useDataStream();

	return (
		<div
			className="group/message fade-in w-full animate-in duration-200"
			data-role={message.role}
			data-testid={`message-${message.role}`}
		>
			<div
				className={cn("flex w-full items-start gap-2 md:gap-3", {
					"justify-end": message.role === "user" && mode !== "edit",
					"justify-start": message.role === "assistant",
				})}
			>
				{message.role === "assistant" && (
					<div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
						<SparklesIcon size={14} />
					</div>
				)}

				<div
					className={cn("flex flex-col", {
						"gap-2 md:gap-4": message.parts?.some(
							(p) => p.type === "text" && p.text?.trim(),
						),
						"w-full":
							(message.role === "assistant" &&
								(message.parts?.some(
									(p) => p.type === "text" && p.text?.trim(),
								) ||
									message.parts?.some((p) => p.type.startsWith("tool-")))) ||
							mode === "edit",
						"max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
							message.role === "user" && mode !== "edit",
					})}
				>
					{attachmentsFromMessage.length > 0 && (
						<div
							className="flex flex-row justify-end gap-2"
							data-testid={"message-attachments"}
						>
							{attachmentsFromMessage.map((attachment) => (
								<PreviewAttachment
									attachment={{
										name: attachment.filename ?? "file",
										contentType: attachment.mediaType,
										url: attachment.url,
									}}
									key={attachment.url}
								/>
							))}
						</div>
					)}

					{message.parts?.map((part, index) => {
						const { type } = part;
						const key = `message-${message.id}-part-${index}`;

						if (type === "reasoning" && part.text?.trim().length > 0) {
							return (
								<MessageReasoning
									isLoading={isLoading}
									key={key}
									reasoning={part.text}
								/>
							);
						}

						if (type === "text") {
							if (mode === "view") {
								return (
									<div key={key}>
										<MessageContent
											className={cn({
												"wrap-break-word w-fit rounded-2xl px-3 py-2 text-right text-white":
													message.role === "user",
												"bg-transparent px-0 py-0 text-left":
													message.role === "assistant",
											})}
											data-testid="message-content"
											style={
												message.role === "user"
													? { backgroundColor: "#006cff" }
													: undefined
											}
										>
											<Response>
												{sanitizeText("text" in part ? part.text : "")}
											</Response>
										</MessageContent>
									</div>
								);
							}

							if (mode === "edit") {
								return (
									<div
										className="flex w-full flex-row items-start gap-3"
										key={key}
									>
										<div className="size-8" />
										<div className="min-w-0 flex-1">
											<MessageEditor
												key={message.id}
												message={message}
												regenerate={regenerate}
												setMessages={setMessages}
												setMode={setMode}
											/>
										</div>
									</div>
								);
							}
						}

						if (type === "tool-getWeather") {
							const { toolCallId, state } = part;
							const approvalId = (part as { approval?: { id: string } })
								.approval?.id;
							const isDenied =
								state === "output-denied" ||
								(state === "approval-responded" &&
									(part as { approval?: { approved?: boolean } }).approval
										?.approved === false);
							const widthClass = "w-[min(100%,450px)]";

							if (state === "output-available") {
								return (
									<div className={widthClass} key={toolCallId}>
										<Weather weatherAtLocation={part.output as any} />
									</div>
								);
							}

							if (isDenied) {
								return (
									<div className={widthClass} key={toolCallId}>
										<Tool className="w-full" defaultOpen={true}>
											<ToolHeader
												state="output-denied"
												type="tool-getWeather"
											/>
											<ToolContent>
												<div className="px-4 py-3 text-muted-foreground text-sm">
													Weather lookup was denied.
												</div>
											</ToolContent>
										</Tool>
									</div>
								);
							}

							if (state === "approval-responded") {
								return (
									<div className={widthClass} key={toolCallId}>
										<Tool className="w-full" defaultOpen={true}>
											<ToolHeader state={state} type="tool-getWeather" />
											<ToolContent>
												<ToolInput input={part.input} />
											</ToolContent>
										</Tool>
									</div>
								);
							}

							return (
								<div className={widthClass} key={toolCallId}>
									<Tool className="w-full" defaultOpen={true}>
										<ToolHeader state={state} type="tool-getWeather" />
										<ToolContent>
											{(state === "input-available" ||
												state === "approval-requested") && (
												<ToolInput input={part.input} />
											)}
											{state === "approval-requested" && approvalId && (
												<div
													aria-label="Weather lookup permission request"
													className="flex items-center justify-end gap-2 border-t px-4 py-3"
													role="group"
												>
													<button
														aria-label="Deny weather lookup request"
														className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
														onClick={() => {
															addToolApprovalResponse({
																id: approvalId,
																approved: false,
																reason: "User denied weather lookup",
															});
														}}
														type="button"
													>
														Deny
													</button>
													<button
														aria-label="Allow weather lookup request"
														className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
														onClick={() => {
															addToolApprovalResponse({
																id: approvalId,
																approved: true,
															});
														}}
														type="button"
													>
														Allow
													</button>
												</div>
											)}
										</ToolContent>
									</Tool>
								</div>
							);
						}

						if (type === "tool-plan") {
							const { toolCallId, state } = part;
							const widthClass = "w-[min(100%,600px)]";

							if (state === "output-available") {
								return (
									<div className={widthClass} key={toolCallId}>
										<PlanVisualizer data={part.output as any} />
									</div>
								);
							}

							return (
								<div className={widthClass} key={toolCallId}>
									<Tool className="w-full" defaultOpen={true}>
										<ToolHeader state={state} type="tool-plan" />
										<ToolContent>
											{state === "input-available" && (
												<ToolInput input={part.input} />
											)}
										</ToolContent>
									</Tool>
								</div>
							);
						}

						if (type === "tool-web_search") {
							const { toolCallId, state } = part;
							const widthClass = "w-[min(100%,600px)]";

							if (state === "output-available") {
								return (
									<div className={widthClass} key={toolCallId}>
										<SearchResults data={part.output as any} />
									</div>
								);
							}

							return (
								<div className={widthClass} key={toolCallId}>
									<Tool className="w-full" defaultOpen={true}>
										<ToolHeader state={state} type="tool-web_search" />
										<ToolContent>
											{state === "input-available" && (
												<ToolInput input={part.input} />
											)}
										</ToolContent>
									</Tool>
								</div>
							);
						}

						if (type === "tool-duyet_mcp") {
							const { toolCallId, state } = part;
							const widthClass = "w-[min(100%,600px)]";

							if (state === "output-available") {
								return (
									<div className={widthClass} key={toolCallId}>
										<DuyetMCPResults data={part.output as any} />
									</div>
								);
							}

							return (
								<div className={widthClass} key={toolCallId}>
									<Tool className="w-full" defaultOpen={true}>
										<ToolHeader state={state} type="tool-duyet_mcp" />
										<ToolContent>
											{state === "input-available" && (
												<ToolInput input={part.input} />
											)}
										</ToolContent>
									</Tool>
								</div>
							);
						}

						if (type === "tool-url_fetch") {
							const { toolCallId, state } = part;
							const approvalId = (part as { approval?: { id: string } })
								.approval?.id;
							const isDenied =
								state === "output-denied" ||
								(state === "approval-responded" &&
									(part as { approval?: { approved?: boolean } }).approval
										?.approved === false);
							const widthClass = "w-[min(100%,600px)]";

							if (state === "output-available") {
								return (
									<div className={widthClass} key={toolCallId}>
										<UrlFetchPreview data={part.output as any} />
									</div>
								);
							}

							if (isDenied) {
								return (
									<div className={widthClass} key={toolCallId}>
										<Tool className="w-full" defaultOpen={true}>
											<ToolHeader state="output-denied" type="tool-url_fetch" />
											<ToolContent>
												<div className="px-4 py-3 text-muted-foreground text-sm">
													URL fetch was denied.
												</div>
											</ToolContent>
										</Tool>
									</div>
								);
							}

							if (state === "approval-responded") {
								return (
									<div className={widthClass} key={toolCallId}>
										<Tool className="w-full" defaultOpen={true}>
											<ToolHeader state={state} type="tool-url_fetch" />
											<ToolContent>
												<ToolInput input={part.input} />
											</ToolContent>
										</Tool>
									</div>
								);
							}

							return (
								<div className={widthClass} key={toolCallId}>
									<Tool className="w-full" defaultOpen={true}>
										<ToolHeader state={state} type="tool-url_fetch" />
										<ToolContent>
											{(state === "input-available" ||
												state === "approval-requested") && (
												<ToolInput input={part.input} />
											)}
											{state === "approval-requested" && approvalId && (
												<div
													aria-label="URL fetch permission request"
													className="flex items-center justify-end gap-2 border-t px-4 py-3"
													role="group"
												>
													<button
														aria-label="Deny URL fetch request"
														className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
														onClick={() => {
															addToolApprovalResponse({
																id: approvalId,
																approved: false,
																reason: "User denied URL fetch",
															});
														}}
														type="button"
													>
														Deny
													</button>
													<button
														aria-label="Allow URL fetch request"
														className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
														onClick={() => {
															addToolApprovalResponse({
																id: approvalId,
																approved: true,
															});
														}}
														type="button"
													>
														Allow
													</button>
												</div>
											)}
										</ToolContent>
									</Tool>
								</div>
							);
						}

						if (type === "tool-scratchpad") {
							const { toolCallId, state } = part;
							const widthClass = "w-[min(100%,500px)]";

							if (state === "output-available") {
								return (
									<div className={widthClass} key={toolCallId}>
										<ScratchpadViewer data={part.output as any} />
									</div>
								);
							}

							return (
								<div className={widthClass} key={toolCallId}>
									<Tool className="w-full" defaultOpen={true}>
										<ToolHeader state={state} type="tool-scratchpad" />
										<ToolContent>
											{state === "input-available" && (
												<ToolInput input={part.input} />
											)}
										</ToolContent>
									</Tool>
								</div>
							);
						}

						if (type === "tool-createDocument") {
							const { toolCallId } = part;

							if (part.output && "error" in part.output) {
								return (
									<div
										className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
										key={toolCallId}
									>
										Error creating document: {String(part.output.error)}
									</div>
								);
							}

							return (
								<DocumentPreview
									isReadonly={isReadonly}
									key={toolCallId}
									result={part.output}
								/>
							);
						}

						if (type === "tool-updateDocument") {
							const { toolCallId } = part;

							if (part.output && "error" in part.output) {
								return (
									<div
										className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
										key={toolCallId}
									>
										Error updating document: {String(part.output.error)}
									</div>
								);
							}

							return (
								<div className="relative" key={toolCallId}>
									<DocumentPreview
										args={{ ...part.output, isUpdate: true }}
										isReadonly={isReadonly}
										result={part.output}
									/>
								</div>
							);
						}

						if (type === "tool-requestSuggestions") {
							const { toolCallId, state } = part;

							return (
								<Tool defaultOpen={true} key={toolCallId}>
									<ToolHeader state={state} type="tool-requestSuggestions" />
									<ToolContent>
										{state === "input-available" && (
											<ToolInput input={part.input} />
										)}
										{state === "output-available" && (
											<ToolOutput
												errorText={undefined}
												output={
													"error" in part.output ? (
														<div className="rounded border p-2 text-red-500">
															Error: {String(part.output.error)}
														</div>
													) : (
														<DocumentToolResult
															isReadonly={isReadonly}
															result={part.output}
															type="request-suggestions"
														/>
													)
												}
											/>
										)}
									</ToolContent>
								</Tool>
							);
						}

						return null;
					})}

					{/* Token usage display for assistant messages when not loading */}
					{message.role === "assistant" &&
						!isLoading &&
						message.metadata?.usage && (
							<TokenUsageDisplay
								className="mt-2 opacity-60 transition-opacity hover:opacity-100"
								showCost={false}
								usage={message.metadata.usage as TokenUsage}
								variant="compact"
							/>
						)}

					{!isReadonly && (
						<MessageActions
							chatId={chatId}
							isLoading={isLoading}
							key={`action-${message.id}`}
							message={message}
							setMessages={setMessages}
							setMode={setMode}
							vote={vote}
						/>
					)}
				</div>
			</div>
		</div>
	);
};

export const PreviewMessage = memo(
	PurePreviewMessage,
	(prevProps, nextProps) => {
		if (
			prevProps.isLoading === nextProps.isLoading &&
			prevProps.message.id === nextProps.message.id &&
			prevProps.requiresScrollPadding === nextProps.requiresScrollPadding &&
			equal(prevProps.message.parts, nextProps.message.parts) &&
			equal(prevProps.message.metadata, nextProps.message.metadata) &&
			equal(prevProps.vote, nextProps.vote)
		) {
			return true;
		}
		return false;
	},
);

export const ThinkingMessage = () => {
	return (
		<div
			className="group/message fade-in w-full animate-in duration-300"
			data-role="assistant"
			data-testid="message-assistant-loading"
		>
			<div className="flex items-start justify-start gap-3">
				<div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
					<div className="animate-pulse">
						<SparklesIcon size={14} />
					</div>
				</div>

				<div className="flex w-full flex-col gap-2 md:gap-4">
					<div className="flex items-center gap-2 p-0 text-muted-foreground text-sm">
						<span>Thinking</span>
						<TypingIndicator className="scale-75" variant="dots" />
					</div>
				</div>
			</div>
		</div>
	);
};
