"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import { CheckIcon, MicIcon, MicOffIcon } from "lucide-react";
import {
	type Dispatch,
	memo,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorGroup,
	ModelSelectorInput,
	ModelSelectorItem,
	ModelSelectorList,
	ModelSelectorLogo,
	ModelSelectorName,
	ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useInputPersistence } from "@/hooks/use-input-persistence";
import { useIsDesktop } from "@/hooks/use-responsive";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
	chatModels,
	DEFAULT_CHAT_MODEL,
	modelsByProvider,
} from "@/lib/ai/models";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
	PromptInput,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "./elements/prompt-input";
import { ArrowUpIcon, PaperclipIcon, StopIcon } from "./icons";
import {
	MentionAutocomplete,
	useMentionAutocomplete,
} from "./mention-autocomplete";
import { PreviewAttachment } from "./preview-attachment";
import { SuggestedActions } from "./suggested-actions";
import { Button } from "./ui/button";
import type { VisibilityType } from "./visibility-selector";

function setCookie(name: string, value: string) {
	const maxAge = 60 * 60 * 24 * 365; // 1 year
	// biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

function PureMultimodalInput({
	chatId,
	input,
	setInput,
	status,
	stop,
	attachments,
	setAttachments,
	messages,
	setMessages,
	sendMessage,
	className,
	selectedVisibilityType,
	selectedModelId,
	onModelChange,
}: {
	chatId: string;
	input: string;
	setInput: Dispatch<SetStateAction<string>>;
	status: UseChatHelpers<ChatMessage>["status"];
	stop: () => void;
	attachments: Attachment[];
	setAttachments: Dispatch<SetStateAction<Attachment[]>>;
	messages: UIMessage[];
	setMessages: UseChatHelpers<ChatMessage>["setMessages"];
	sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
	className?: string;
	selectedVisibilityType: VisibilityType;
	selectedModelId: string;
	onModelChange?: (modelId: string) => void;
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isDesktop = useIsDesktop();
	const { cursorPosition, updateCursorPosition, setCursorPosition } =
		useMentionAutocomplete();

	const adjustHeight = useCallback(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "44px";
		}
	}, []);

	useEffect(() => {
		if (textareaRef.current) {
			adjustHeight();
		}
	}, [adjustHeight]);

	// Auto-focus the textarea on desktop after initial render
	const hasAutoFocused = useRef(false);
	useEffect(() => {
		if (!hasAutoFocused.current && isDesktop) {
			const timer = setTimeout(() => {
				textareaRef.current?.focus();
				hasAutoFocused.current = true;
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [isDesktop]);

	const resetHeight = useCallback(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "44px";
		}
	}, []);

	// Use the input persistence hook for localStorage management
	const { setLocalStorageInput, handleInputPersistence } = useInputPersistence({
		textareaRef,
		onInputChange: setInput,
		adjustHeight,
		input,
	});

	// Handle hydration from localStorage
	useEffect(() => {
		handleInputPersistence();
		// Only run once after hydration
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [handleInputPersistence]);

	const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(event.target.value);
		updateCursorPosition(event);
	};

	// Handle voice input transcription
	const handleVoiceTranscript = useCallback(
		(transcribedText: string) => {
			setInput((prev) => {
				const separator = prev.trim() ? " " : "";
				return prev + separator + transcribedText;
			});
			// Focus the textarea after voice input
			textareaRef.current?.focus();
		},
		[setInput],
	);

	// Handle mention selection from autocomplete
	const handleMentionSelect = useCallback(
		(newText: string, newCursorPosition: number) => {
			setInput(newText);
			setCursorPosition(newCursorPosition);
			// Set cursor position in textarea after React updates the value
			requestAnimationFrame(() => {
				if (textareaRef.current) {
					textareaRef.current.selectionStart = newCursorPosition;
					textareaRef.current.selectionEnd = newCursorPosition;
					textareaRef.current.focus();
				}
			});
		},
		[setInput, setCursorPosition],
	);

	// Dismiss mention autocomplete
	const handleMentionDismiss = useCallback(() => {
		// Reset cursor tracking - the autocomplete will hide itself
		if (textareaRef.current) {
			textareaRef.current.focus();
		}
	}, []);

	const fileInputRef = useRef<HTMLInputElement>(null);

	// Use the file upload hook for file upload logic
	const { uploadQueue, handleFileChange, handlePaste } = useFileUpload({
		onAttachmentsChange: setAttachments,
	});

	const submitForm = useCallback(() => {
		window.history.pushState({}, "", `/chat/${chatId}`);

		sendMessage({
			role: "user",
			parts: [
				...attachments.map((attachment) => ({
					type: "file" as const,
					url: attachment.url,
					name: attachment.name,
					mediaType: attachment.contentType,
				})),
				{
					type: "text" as const,
					text: input,
				},
			],
		});

		setAttachments([]);
		setLocalStorageInput("");
		resetHeight();
		setInput("");

		// Auto-focus on desktop/tablet (not mobile) for better UX
		if (isDesktop) {
			textareaRef.current?.focus();
		}
	}, [
		input,
		setInput,
		attachments,
		sendMessage,
		setAttachments,
		setLocalStorageInput,
		isDesktop,
		chatId,
		resetHeight,
	]);

	// Add paste event listener to textarea
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) {
			return;
		}

		textarea.addEventListener("paste", handlePaste);
		return () => textarea.removeEventListener("paste", handlePaste);
	}, [handlePaste]);

	return (
		<div className={cn("relative flex w-full flex-col gap-4", className)}>
			{messages.length === 0 &&
				attachments.length === 0 &&
				uploadQueue.length === 0 && (
					<SuggestedActions
						chatId={chatId}
						selectedVisibilityType={selectedVisibilityType}
						sendMessage={sendMessage}
					/>
				)}

			<input
				aria-label="Upload files to attach to your message"
				className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
				multiple
				onChange={handleFileChange}
				ref={fileInputRef}
				tabIndex={-1}
				type="file"
			/>

			<PromptInput
				className="rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-ring focus-within:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] hover:border-muted-foreground/50"
				onSubmit={(event) => {
					event.preventDefault();
					if (status !== "ready") {
						toast.error("Please wait for the model to finish its response!");
					} else {
						submitForm();
					}
				}}
			>
				{(attachments.length > 0 || uploadQueue.length > 0) && (
					<div
						className="flex flex-row items-end gap-2 overflow-x-scroll"
						data-testid="attachments-preview"
					>
						{attachments.map((attachment) => (
							<PreviewAttachment
								attachment={attachment}
								key={attachment.url}
								onRemove={() => {
									setAttachments((currentAttachments) =>
										currentAttachments.filter((a) => a.url !== attachment.url),
									);
									if (fileInputRef.current) {
										fileInputRef.current.value = "";
									}
								}}
							/>
						))}

						{uploadQueue.map((filename) => (
							<PreviewAttachment
								attachment={{
									url: "",
									name: filename,
									contentType: "",
								}}
								isUploading={true}
								key={filename}
							/>
						))}
					</div>
				)}
				<div className="relative flex flex-row items-start gap-1 sm:gap-2">
					<MentionAutocomplete
						cursorPosition={cursorPosition}
						inputValue={input}
						onDismiss={handleMentionDismiss}
						onSelect={handleMentionSelect}
					/>
					<PromptInputTextarea
						className="grow resize-none border-0! border-none! bg-transparent p-2 text-base outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
						data-testid="multimodal-input"
						disableAutoResize={true}
						maxHeight={200}
						minHeight={44}
						onChange={handleInput}
						onKeyUp={updateCursorPosition}
						onClick={(e) =>
							setCursorPosition(
								(e.target as HTMLTextAreaElement).selectionStart ?? 0,
							)
						}
						placeholder="Send a message... (type @ to mention tools)"
						ref={textareaRef}
						rows={1}
						value={input}
					/>
				</div>
				<PromptInputToolbar className="border-top-0! border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
					<PromptInputTools className="gap-0 sm:gap-0.5">
						<AttachmentsButton
							fileInputRef={fileInputRef}
							selectedModelId={selectedModelId}
							status={status}
						/>
						<VoiceInputButton
							onTranscript={handleVoiceTranscript}
							status={status}
						/>
						<ModelSelectorCompact
							onModelChange={onModelChange}
							selectedModelId={selectedModelId}
						/>
					</PromptInputTools>

					{status === "submitted" ? (
						<StopButton setMessages={setMessages} stop={stop} />
					) : (
						<PromptInputSubmit
							className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
							data-testid="send-button"
							disabled={!input.trim() || uploadQueue.length > 0}
							status={status}
						>
							<ArrowUpIcon size={14} />
						</PromptInputSubmit>
					)}
				</PromptInputToolbar>
			</PromptInput>
		</div>
	);
}

export const MultimodalInput = memo(
	PureMultimodalInput,
	(prevProps, nextProps) => {
		if (prevProps.input !== nextProps.input) {
			return false;
		}
		if (prevProps.status !== nextProps.status) {
			return false;
		}
		if (!equal(prevProps.attachments, nextProps.attachments)) {
			return false;
		}
		if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
			return false;
		}
		if (prevProps.selectedModelId !== nextProps.selectedModelId) {
			return false;
		}

		return true;
	},
);

function PureAttachmentsButton({
	fileInputRef,
	status,
	selectedModelId,
}: {
	fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
	status: UseChatHelpers<ChatMessage>["status"];
	selectedModelId: string;
}) {
	const isReasoningModel =
		selectedModelId.includes("reasoning") || selectedModelId.includes("think");

	return (
		<Button
			className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
			data-testid="attachments-button"
			disabled={status !== "ready" || isReasoningModel}
			onClick={(event) => {
				event.preventDefault();
				fileInputRef.current?.click();
			}}
			variant="ghost"
		>
			<PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
		</Button>
	);
}

const AttachmentsButton = memo(PureAttachmentsButton);

// Provider metadata for display
const providerInfo: Record<
	string,
	{ name: string; icon: string; description: string }
> = {
	anthropic: {
		name: "Anthropic",
		icon: "anthropic",
		description: "Claude models - safe and capable",
	},
	openai: {
		name: "OpenAI",
		icon: "openai",
		description: "GPT and o1 models",
	},
	google: {
		name: "Google",
		icon: "google",
		description: "Gemini multimodal models",
	},
	xai: {
		name: "xAI",
		icon: "xai",
		description: "Grok models",
	},
	deepseek: {
		name: "DeepSeek",
		icon: "deepseek",
		description: "Open-weight models from China",
	},
	reasoning: {
		name: "🧠 Reasoning",
		icon: "",
		description: "Extended thinking models",
	},
};

function PureModelSelectorCompact({
	selectedModelId,
	onModelChange,
}: {
	selectedModelId: string;
	onModelChange?: (modelId: string) => void;
}) {
	const [open, setOpen] = useState(false);

	const selectedModel =
		chatModels.find((m) => m.id === selectedModelId) ??
		chatModels.find((m) => m.id === DEFAULT_CHAT_MODEL) ??
		chatModels[0];
	const [provider] = selectedModel.id.split("/");

	return (
		<ModelSelector onOpenChange={setOpen} open={open}>
			<ModelSelectorTrigger asChild>
				<Button
					className="h-8 w-[200px] justify-between gap-2 px-2"
					data-testid="model-selector-button"
					variant="ghost"
				>
					{provider && <ModelSelectorLogo provider={provider} />}
					<ModelSelectorName>{selectedModel.name}</ModelSelectorName>
				</Button>
			</ModelSelectorTrigger>
			<ModelSelectorContent className="w-[360px]">
				<ModelSelectorInput placeholder="Search models by name or provider..." />
				<ModelSelectorList className="max-h-[400px]">
					{Object.entries(modelsByProvider).map(
						([providerKey, providerModels]) => {
							const info = providerInfo[providerKey] ?? {
								name: providerKey,
								icon: providerKey,
								description: "",
							};
							return (
								<ModelSelectorGroup heading={info.name} key={providerKey}>
									{providerModels.map((model) => {
										const logoProvider = model.id.split("/")[0];
										const isSelected = model.id === selectedModel.id;
										return (
											<ModelSelectorItem
												className="flex flex-col items-start gap-0.5 py-2"
												key={model.id}
												onSelect={() => {
													onModelChange?.(model.id);
													setCookie("chat-model", model.id);
													setOpen(false);
												}}
												value={`${model.id} ${model.name} ${model.description}`}
											>
												<div className="flex w-full items-center gap-2">
													<ModelSelectorLogo provider={logoProvider} />
													<ModelSelectorName className="font-medium">
														{model.name}
													</ModelSelectorName>
													{isSelected && (
														<CheckIcon className="ml-auto size-4 shrink-0 text-primary" />
													)}
												</div>
												<span className="pl-5 text-muted-foreground text-xs">
													{model.description}
												</span>
											</ModelSelectorItem>
										);
									})}
								</ModelSelectorGroup>
							);
						},
					)}
				</ModelSelectorList>
			</ModelSelectorContent>
		</ModelSelector>
	);
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
	stop,
	setMessages,
}: {
	stop: () => void;
	setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
	return (
		<Button
			className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
			data-testid="stop-button"
			onClick={(event) => {
				event.preventDefault();
				stop();
				setMessages((messages) => messages);
			}}
		>
			<StopIcon size={14} />
		</Button>
	);
}

const StopButton = memo(PureStopButton);

function PureVoiceInputButton({
	status,
	onTranscript,
}: {
	status: UseChatHelpers<ChatMessage>["status"];
	onTranscript: (text: string) => void;
}) {
	const {
		state,
		transcript,
		isSupported,
		startListening,
		stopListening,
		resetTranscript,
	} = useSpeechRecognition({
		continuous: true,
		interimResults: true,
	});

	const isListening = state === "listening" || state === "starting";

	// When transcript changes, append to input
	useEffect(() => {
		if (transcript) {
			onTranscript(transcript);
			resetTranscript();
		}
	}, [transcript, onTranscript, resetTranscript]);

	const handleClick = useCallback(() => {
		if (isListening) {
			stopListening();
		} else {
			startListening();
		}
	}, [isListening, startListening, stopListening]);

	// Don't render if not supported
	if (!isSupported) {
		return null;
	}

	return (
		<Button
			aria-label={isListening ? "Stop voice input" : "Start voice input"}
			className={cn(
				"aspect-square h-8 rounded-lg p-1 transition-all duration-200",
				isListening
					? "animate-pulse bg-red-500/10 text-red-500 hover:bg-red-500/20"
					: "text-muted-foreground hover:bg-accent",
			)}
			data-testid="voice-input-button"
			disabled={status !== "ready"}
			onClick={handleClick}
			title={
				isListening ? "Click to stop voice input" : "Click to start voice input"
			}
			variant="ghost"
		>
			{isListening ? (
				<MicOffIcon size={14} style={{ width: 14, height: 14 }} />
			) : (
				<MicIcon size={14} style={{ width: 14, height: 14 }} />
			)}
		</Button>
	);
}

const VoiceInputButton = memo(PureVoiceInputButton);
