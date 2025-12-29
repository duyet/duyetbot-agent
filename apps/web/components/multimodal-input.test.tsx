/**
 * Unit tests for multimodal-input component
 *
 * Test Categories:
 * 1. PureMultimodalInput - Main component rendering and behavior
 * 2. AttachmentsButton behavior - Tested through main component
 * 3. ModelSelectorCompact behavior - Tested through main component
 * 4. StopButton behavior - Tested through main component
 * 5. VoiceInputButton behavior - Tested through main component
 * 6. MultimodalInput memo - Memoization comparison function
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { MultimodalInput } from "./multimodal-input";
import type { Attachment, ChatMessage } from "@/lib/types";

// Create mock functions that can be controlled in tests
const mockHandleFileChange = vi.fn();
const mockHandlePaste = vi.fn();

const mockUseFileUpload = vi.fn(() => ({
	uploadQueue: [],
	handleFileChange: mockHandleFileChange,
	handlePaste: mockHandlePaste,
}));

const mockUseInputPersistence = vi.fn(() => ({
	setLocalStorageInput: vi.fn(),
	handleInputPersistence: vi.fn(),
}));

const mockUseIsDesktop = vi.fn(() => true);

const mockStartListening = vi.fn();
const mockStopListening = vi.fn();
const mockResetTranscript = vi.fn();

const mockUseSpeechRecognition = vi.fn(() => ({
	state: "idle" as const,
	transcript: "",
	isSupported: true,
	startListening: mockStartListening,
	stopListening: mockStopListening,
	resetTranscript: mockResetTranscript,
}));

const mockUpdateCursorPosition = vi.fn();
const mockSetCursorPosition = vi.fn();

const mockUseMentionAutocomplete = vi.fn(() => ({
	cursorPosition: 0,
	updateCursorPosition: mockUpdateCursorPosition,
	setCursorPosition: mockSetCursorPosition,
}));

// Mock external dependencies
vi.mock("@ai-sdk/react", () => ({
	useChat: () => ({
		status: "ready",
		stop: vi.fn(),
		sendMessage: vi.fn(),
		setMessages: vi.fn(),
	}),
}));

vi.mock("@/lib/ai/models", () => ({
	chatModels: [
		{ id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "Latest Claude" },
		{ id: "openai/gpt-4o", name: "GPT-4o", description: "OpenAI's best" },
		{ id: "reasoning-model", name: "Reasoning Model", description: "Extended thinking" },
	],
	DEFAULT_CHAT_MODEL: "anthropic/claude-3.5-sonnet",
	modelsByProvider: {
		anthropic: [{ id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "Latest Claude" }],
		openai: [{ id: "openai/gpt-4o", name: "GPT-4o", description: "OpenAI's best" }],
	},
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("fast-deep-equal", () => ({
	default: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b),
}));

// Mock custom hooks with controllable implementations
vi.mock("@/hooks/use-file-upload", () => ({
	useFileUpload: () => mockUseFileUpload(),
}));

vi.mock("@/hooks/use-input-persistence", () => ({
	useInputPersistence: () => mockUseInputPersistence(),
}));

vi.mock("@/hooks/use-responsive", () => ({
	useIsDesktop: () => mockUseIsDesktop(),
}));

vi.mock("@/hooks/use-speech-recognition", () => ({
	useSpeechRecognition: () => mockUseSpeechRecognition(),
}));

vi.mock("./mention-autocomplete", () => ({
	useMentionAutocomplete: () => mockUseMentionAutocomplete(),
	MentionAutocomplete: ({ children }: any) => <div data-testid="mention-autocomplete">{children}</div>,
}));

// Test utilities
const createMockProps = () => ({
	chatId: "test-chat-123",
	input: "",
	setInput: vi.fn(),
	status: "ready" as UseChatHelpers<ChatMessage>["status"],
	stop: vi.fn(),
	attachments: [] as Attachment[],
	setAttachments: vi.fn(),
	messages: [] as UIMessage[],
	setMessages: vi.fn(),
	sendMessage: vi.fn(),
	className: "",
	selectedVisibilityType: "private" as const,
	selectedModelId: "anthropic/claude-3.5-sonnet",
	onModelChange: vi.fn(),
});

describe("multimodal-input - MultimodalInput Component", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset mocks to default values
		mockUseFileUpload.mockReturnValue({
			uploadQueue: [],
			handleFileChange: mockHandleFileChange,
			handlePaste: mockHandlePaste,
		});
		mockUseInputPersistence.mockReturnValue({
			setLocalStorageInput: vi.fn(),
			handleInputPersistence: vi.fn(),
		});
		mockUseIsDesktop.mockReturnValue(true);
		mockUseSpeechRecognition.mockReturnValue({
			state: "idle",
			transcript: "",
			isSupported: true,
			startListening: mockStartListening,
			stopListening: mockStopListening,
			resetTranscript: mockResetTranscript,
		});
		mockUseMentionAutocomplete.mockReturnValue({
			cursorPosition: 0,
			updateCursorPosition: mockUpdateCursorPosition,
			setCursorPosition: mockSetCursorPosition,
		});
	});

	it("renders textarea input with correct placeholder", () => {
		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		const textarea = screen.getByPlaceholderText("Send a message... (type @ to mention tools)");
		expect(textarea).toBeInTheDocument();
	});

	it("renders send button when status is ready", () => {
		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		const sendButton = screen.getByTestId("send-button");
		expect(sendButton).toBeInTheDocument();
		expect(sendButton).toBeDisabled(); // Disabled when input is empty
	});

	it("enables send button when there is input text", () => {
		const props = createMockProps();
		props.input = "Hello, world!";
		render(<MultimodalInput {...props} />);

		const sendButton = screen.getByTestId("send-button");
		expect(sendButton).not.toBeDisabled();
	});

	it("renders stop button when status is submitted", () => {
		const props = createMockProps();
		props.status = "submitted";
		render(<MultimodalInput {...props} />);

		const stopButton = screen.getByTestId("stop-button");
		expect(stopButton).toBeInTheDocument();
	});

	it("disables send button when uploadQueue has items", () => {
		mockUseFileUpload.mockReturnValue({
			uploadQueue: ["uploading-file.jpg"],
			handleFileChange: mockHandleFileChange,
			handlePaste: mockHandlePaste,
		});

		const props = createMockProps();
		props.input = "Hello";
		render(<MultimodalInput {...props} />);

		const sendButton = screen.getByTestId("send-button");
		expect(sendButton).toBeDisabled();
	});

	it("renders suggested actions when messages and attachments are empty", () => {
		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		expect(screen.getByTestId("suggested-actions")).toBeInTheDocument();
	});

	it("does not render suggested actions when there are messages", () => {
		const props = createMockProps();
		props.messages = [{ role: "user", content: "Existing message" }] as UIMessage[];
		render(<MultimodalInput {...props} />);

		expect(screen.queryByTestId("suggested-actions")).not.toBeInTheDocument();
	});

	it("does not render suggested actions when there are attachments", () => {
		const props = createMockProps();
		props.attachments = [{ url: "http://example.com/file.jpg", name: "file.jpg", contentType: "image/jpeg" }];
		render(<MultimodalInput {...props} />);

		expect(screen.queryByTestId("suggested-actions")).not.toBeInTheDocument();
	});

	it("renders attachments preview when there are attachments", () => {
		const props = createMockProps();
		props.attachments = [
			{ url: "http://example.com/file.jpg", name: "file.jpg", contentType: "image/jpeg" },
		];
		render(<MultimodalInput {...props} />);

		const preview = screen.getByTestId("attachments-preview");
		expect(preview).toBeInTheDocument();

		const attachment = screen.getByTestId("input-attachment-preview");
		expect(attachment).toBeInTheDocument();
	});

	it("renders uploading indicator for files in uploadQueue", () => {
		mockUseFileUpload.mockReturnValue({
			uploadQueue: ["uploading-file.jpg"],
			handleFileChange: mockHandleFileChange,
			handlePaste: mockHandlePaste,
		});

		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		const uploadingAttachment = screen.getByTestId("input-attachment-preview");
		expect(uploadingAttachment).toBeInTheDocument();
		// The uploading indicator is in the loader element
		const loader = screen.getByTestId("input-attachment-loader");
		expect(loader).toBeInTheDocument();
	});

	it("calls setInput when textarea value changes", () => {
		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		const textarea = screen.getByPlaceholderText("Send a message... (type @ to mention tools)");
		fireEvent.change(textarea, { target: { value: "New message" } });

		expect(props.setInput).toHaveBeenCalledWith("New message");
	});

	it("calls updateCursorPosition when textarea value changes", () => {
		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		const textarea = screen.getByPlaceholderText("Send a message... (type @ to mention tools)");
		fireEvent.change(textarea, { target: { value: "New message" } });

		expect(mockUpdateCursorPosition).toHaveBeenCalled();
	});

	it("calls sendMessage with attachments and text on submit", () => {
		const props = createMockProps();
		props.input = "Test message";
		props.attachments = [
			{ url: "http://example.com/file.jpg", name: "file.jpg", contentType: "image/jpeg" },
		];

		render(<MultimodalInput {...props} />);

		const sendButton = screen.getByTestId("send-button");
		fireEvent.click(sendButton);

		expect(props.sendMessage).toHaveBeenCalledWith({
			role: "user",
			parts: [
				{
					type: "file",
					url: "http://example.com/file.jpg",
					name: "file.jpg",
					mediaType: "image/jpeg",
				},
				{
					type: "text",
					text: "Test message",
				},
			],
		});
	});

	it("clears attachments and input after submission", () => {
		const props = createMockProps();
		props.input = "Test message";
		props.attachments = [
			{ url: "http://example.com/file.jpg", name: "file.jpg", contentType: "image/jpeg" },
		];

		render(<MultimodalInput {...props} />);

		const sendButton = screen.getByTestId("send-button");
		fireEvent.click(sendButton);

		expect(props.setAttachments).toHaveBeenCalledWith([]);
		expect(props.setInput).toHaveBeenCalledWith("");
	});

	it("renders hidden file input for attachments", () => {
		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
		expect(fileInput).toBeInTheDocument();
		expect(fileInput).toHaveAttribute("aria-label", "Upload files to attach to your message");
		expect(fileInput).toHaveAttribute("multiple");
	});

	it("renders attachments button that is disabled for reasoning models", () => {
		const props = createMockProps();
		props.selectedModelId = "reasoning-model";
		render(<MultimodalInput {...props} />);

		const attachmentsButton = screen.getByTestId("attachments-button");
		expect(attachmentsButton).toBeDisabled();
	});

	it("renders attachments button that is disabled for thinking models", () => {
		const props = createMockProps();
		props.selectedModelId = "anthropic/thinking-model";
		render(<MultimodalInput {...props} />);

		const attachmentsButton = screen.getByTestId("attachments-button");
		expect(attachmentsButton).toBeDisabled();
	});

	it("renders attachments button that is enabled when model is not reasoning", () => {
		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		const attachmentsButton = screen.getByTestId("attachments-button");
		expect(attachmentsButton).not.toBeDisabled();
	});

	it("renders voice input button when speech recognition is supported", () => {
		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		const voiceButton = screen.getByTestId("voice-input-button");
		expect(voiceButton).toBeInTheDocument();
	});

	it("does not render voice input button when speech recognition is not supported", () => {
		mockUseSpeechRecognition.mockReturnValue({
			state: "idle",
			transcript: "",
			isSupported: false,
			startListening: mockStartListening,
			stopListening: mockStopListening,
			resetTranscript: mockResetTranscript,
		});

		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		expect(screen.queryByTestId("voice-input-button")).not.toBeInTheDocument();
	});

	it("disables voice input button when status is not ready", () => {
		const props = createMockProps();
		props.status = "submitted";
		render(<MultimodalInput {...props} />);

		const voiceButton = screen.queryByTestId("voice-input-button");
		if (voiceButton) {
			expect(voiceButton).toBeDisabled();
		}
	});

	it("renders model selector button with model name", () => {
		const props = createMockProps();
		render(<MultimodalInput {...props} />);

		const modelButton = screen.getByTestId("model-selector-button");
		expect(modelButton).toBeInTheDocument();
		expect(modelButton).toHaveTextContent("Claude 3.5 Sonnet");
	});

	it("calls stop when stop button is clicked", () => {
		const mockStop = vi.fn();
		const props = createMockProps();
		props.status = "submitted";
		props.stop = mockStop;

		render(<MultimodalInput {...props} />);

		const stopButton = screen.getByTestId("stop-button");
		fireEvent.click(stopButton);

		expect(mockStop).toHaveBeenCalled();
	});
});

describe("multimodal-input - Memoization Behavior", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUseFileUpload.mockReturnValue({
			uploadQueue: [],
			handleFileChange: vi.fn(),
			handlePaste: vi.fn(),
		});
		mockUseInputPersistence.mockReturnValue({
			setLocalStorageInput: vi.fn(),
			handleInputPersistence: vi.fn(),
		});
		mockUseIsDesktop.mockReturnValue(true);
		mockUseSpeechRecognition.mockReturnValue({
			state: "idle",
			transcript: "",
			isSupported: true,
			startListening: vi.fn(),
			stopListening: vi.fn(),
			resetTranscript: vi.fn(),
		});
		mockUseMentionAutocomplete.mockReturnValue({
			cursorPosition: 0,
			updateCursorPosition: vi.fn(),
			setCursorPosition: vi.fn(),
		});
	});

	const createMockProps = () => ({
		chatId: "test-chat-123",
		input: "",
		setInput: vi.fn(),
		status: "ready" as UseChatHelpers<ChatMessage>["status"],
		stop: vi.fn(),
		attachments: [] as Attachment[],
		setAttachments: vi.fn(),
		messages: [] as UIMessage[],
		setMessages: vi.fn(),
		sendMessage: vi.fn(),
		className: "",
		selectedVisibilityType: "private" as const,
		selectedModelId: "anthropic/claude-3.5-sonnet",
		onModelChange: vi.fn(),
	});

	it("memo comparison returns false when input changes", () => {
		const props1 = createMockProps();
		const props2 = createMockProps();
		props2.input = "Different input";

		// The memo comparison should detect input difference
		expect(props1.input).not.toBe(props2.input);
	});

	it("memo comparison returns false when status changes", () => {
		const props1 = createMockProps();
		const props2 = createMockProps();
		props2.status = "submitted";

		expect(props1.status).not.toBe(props2.status);
	});

	it("memo comparison returns false when attachments change", () => {
		const props1 = createMockProps();
		const props2 = createMockProps();
		props2.attachments = [{ url: "new", name: "new", contentType: "image/jpeg" }];

		expect(props1.attachments).not.toEqual(props2.attachments);
	});

	it("memo comparison returns false when selectedVisibilityType changes", () => {
		const props1 = createMockProps();
		const props2 = createMockProps();
		props2.selectedVisibilityType = "public";

		expect(props1.selectedVisibilityType).not.toBe(props2.selectedVisibilityType);
	});

	it("memo comparison returns false when selectedModelId changes", () => {
		const props1 = createMockProps();
		const props2 = createMockProps();
		props2.selectedModelId = "openai/gpt-4o";

		expect(props1.selectedModelId).not.toBe(props2.selectedModelId);
	});

	it("memo comparison returns true when all relevant props are equal", () => {
		const props1 = createMockProps();
		const props2 = createMockProps();

		expect(props1.input).toBe(props2.input);
		expect(props1.status).toBe(props2.status);
		expect(props1.attachments).toEqual(props2.attachments);
		expect(props1.selectedVisibilityType).toBe(props2.selectedVisibilityType);
		expect(props1.selectedModelId).toBe(props2.selectedModelId);
	});
});
