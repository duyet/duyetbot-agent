/**
 * Unit tests for use-file-upload hook
 *
 * Test Categories:
 * 1. Hook initialization and state
 * 2. File selection via input change
 * 3. Paste-to-upload functionality
 * 4. Upload queue management
 * 5. Error handling
 * 6. Multiple file uploads
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Attachment } from "@/lib/types";
import { useFileUpload } from "./use-file-upload";

// Mock sonner toast - use vi.hoisted to make the mock functions available
const mockToast = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: mockToast,
}));

// Helper to create a mock file
const createMockFile = (name: string, type: string): File => {
	const file = new File(["content"], name, { type });
	return file;
};

// Helper to create a mock ChangeEvent
const createMockChangeEvent = (
	files: File[],
): ChangeEvent<HTMLInputElement> => {
	return {
		target: {
			files: files as any,
			value: "",
		},
	} as any;
};

// Helper to create a mock ClipboardEvent
const createMockClipboardEvent = (
	items: DataTransferItem[],
): ClipboardEvent => {
	return {
		clipboardData: {
			items: items as any,
		} as DataTransfer,
		preventDefault: vi.fn(),
	} as any;
};

// Helper to create a mock DataTransferItem
const createMockDataTransferItem = (
	type: string,
	file: File | null,
): DataTransferItem => {
	return {
		kind: "file",
		type,
		getAsFile: () => file,
	} as DataTransferItem;
};

// Helper to create a mock fetch with preconnect method for AI SDK compatibility
const createMockFetch = (response: Partial<Response>) => {
	const mockFn = vi.fn(() => Promise.resolve(response as Response));
	(mockFn as any).preconnect = () => Promise.resolve();
	return mockFn;
};

describe("useFileUpload - Initialization and State", () => {
	it("initializes with empty upload queue", () => {
		const onAttachmentsChange = vi.fn();
		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		expect(result.current.uploadQueue).toEqual([]);
		expect(result.current.handleFileChange).toBeDefined();
		expect(result.current.handlePaste).toBeDefined();
	});

	it("returns all expected API methods", () => {
		const onAttachmentsChange = vi.fn();
		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		expect(result.current.uploadQueue).toBeDefined();
		expect(result.current.handleFileChange).toBeDefined();
		expect(result.current.handlePaste).toBeDefined();
	});
});

describe("useFileUpload - File Selection via Input Change", () => {
	it("uploads single file successfully", async () => {
		const onAttachmentsChange = vi.fn();
		global.fetch = createMockFetch({
			ok: true,
			json: () =>
				Promise.resolve({
					url: "https://example.com/file1.jpg",
					pathname: "file1.jpg",
					contentType: "image/jpeg",
				}),
		});

		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockFile = createMockFile("file1.jpg", "image/jpeg");
		const mockEvent = createMockChangeEvent([mockFile]);

		await act(async () => {
			await result.current.handleFileChange(mockEvent);
		});

		expect(onAttachmentsChange).toHaveBeenCalled();
		expect(result.current.uploadQueue).toEqual([]);
	});

	it("uploads multiple files", async () => {
		const onAttachmentsChange = vi.fn();
		const uploadedFiles: Attachment[] = [
			{
				url: "https://example.com/file1.jpg",
				name: "file1.jpg",
				contentType: "image/jpeg",
			},
			{
				url: "https://example.com/file2.png",
				name: "file2.png",
				contentType: "image/png",
			},
		];

		let callCount = 0;
		global.fetch = createMockFetch(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve(uploadedFiles[callCount++] || uploadedFiles[0]),
			} as Response),
		);

		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockFiles = [
			createMockFile("file1.jpg", "image/jpeg"),
			createMockFile("file2.png", "image/png"),
		];
		const mockEvent = createMockChangeEvent(mockFiles);

		await act(async () => {
			await result.current.handleFileChange(mockEvent);
		});

		expect(onAttachmentsChange).toHaveBeenCalled();
	});

	it("shows upload queue while uploading", async () => {
		const onAttachmentsChange = vi.fn();

		let resolveFetch: () => void;
		global.fetch = createMockFetch(
			() =>
				new Promise((resolve) => {
					resolveFetch = () =>
						resolve({
							ok: true,
							json: () =>
								Promise.resolve({
									url: "https://example.com/file.jpg",
									pathname: "file.jpg",
									contentType: "image/jpeg",
								}),
						} as Response);
				}),
		);

		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockFile = createMockFile("file.jpg", "image/jpeg");
		const mockEvent = createMockChangeEvent([mockFile]);

		const promise = act(async () => {
			await result.current.handleFileChange(mockEvent);
		});

		// While uploading, queue should contain file name
		expect(result.current.uploadQueue).toEqual(["file.jpg"]);

		resolveFetch!();
		await promise;

		// After upload, queue should be empty
		await waitFor(() => {
			expect(result.current.uploadQueue).toEqual([]);
		});
	});
});

describe("useFileUpload - Paste-to-Upload", () => {
	it("uploads pasted image", async () => {
		const onAttachmentsChange = vi.fn();
		global.fetch = createMockFetch(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						url: "https://example.com/pasted.jpg",
						pathname: "pasted.jpg",
						contentType: "image/jpeg",
					}),
			} as Response),
		);

		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockFile = createMockFile("pasted.jpg", "image/jpeg");
		const mockItem = createMockDataTransferItem("image/jpeg", mockFile);
		const mockEvent = createMockClipboardEvent([mockItem]);

		await act(async () => {
			await result.current.handlePaste(mockEvent);
		});

		expect(mockEvent.preventDefault).toHaveBeenCalled();
		expect(onAttachmentsChange).toHaveBeenCalled();
	});

	it("ignores non-image paste events", async () => {
		const onAttachmentsChange = vi.fn();
		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockItem = createMockDataTransferItem("text/plain", null);
		const mockEvent = createMockClipboardEvent([mockItem]);

		await act(async () => {
			await result.current.handlePaste(mockEvent);
		});

		expect(mockEvent.preventDefault).not.toHaveBeenCalled();
		expect(onAttachmentsChange).not.toHaveBeenCalled();
	});

	it("handles empty clipboard data", async () => {
		const onAttachmentsChange = vi.fn();
		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockEvent = {
			clipboardData: null,
			preventDefault: vi.fn(),
		} as any;

		await act(async () => {
			await result.current.handlePaste(mockEvent);
		});

		expect(mockEvent.preventDefault).not.toHaveBeenCalled();
	});

	it("uploads multiple pasted images", async () => {
		const onAttachmentsChange = vi.fn();
		const uploadedFiles: Attachment[] = [
			{
				url: "https://example.com/pasted1.jpg",
				name: "pasted1.jpg",
				contentType: "image/jpeg",
			},
			{
				url: "https://example.com/pasted2.png",
				name: "pasted2.png",
				contentType: "image/png",
			},
		];

		let callCount = 0;
		global.fetch = createMockFetch(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve(uploadedFiles[callCount++] || uploadedFiles[0]),
			} as Response),
		);

		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockItems = [
			createMockDataTransferItem(
				"image/jpeg",
				createMockFile("pasted1.jpg", "image/jpeg"),
			),
			createMockDataTransferItem(
				"image/png",
				createMockFile("pasted2.png", "image/png"),
			),
		];
		const mockEvent = createMockClipboardEvent(mockItems);

		await act(async () => {
			await result.current.handlePaste(mockEvent);
		});

		expect(mockEvent.preventDefault).toHaveBeenCalled();
		expect(onAttachmentsChange).toHaveBeenCalled();
	});
});

describe("useFileUpload - Error Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("handles API error response", async () => {
		const onAttachmentsChange = vi.fn();
		global.fetch = createMockFetch(() =>
			Promise.resolve({
				ok: false,
				json: () =>
					Promise.resolve({
						error: "Upload failed",
					}),
			} as Response),
		);

		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockFile = createMockFile("file.jpg", "image/jpeg");
		const mockEvent = createMockChangeEvent([mockFile]);

		await act(async () => {
			await result.current.handleFileChange(mockEvent);
		});

		expect(mockToast.error).toHaveBeenCalledWith("Upload failed");
		expect(onAttachmentsChange).not.toHaveBeenCalled();
	});

	it("handles network error", async () => {
		const onAttachmentsChange = vi.fn();
		global.fetch = createMockFetch(() =>
			Promise.reject(new Error("Network error")),
		);

		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockFile = createMockFile("file.jpg", "image/jpeg");
		const mockEvent = createMockChangeEvent([mockFile]);

		await act(async () => {
			await result.current.handleFileChange(mockEvent);
		});

		expect(mockToast.error).toHaveBeenCalledWith(
			"Failed to upload file, please try again!",
		);
	});

	it("clears queue even on error", async () => {
		const onAttachmentsChange = vi.fn();
		global.fetch = createMockFetch(() =>
			Promise.resolve({
				ok: false,
				json: () =>
					Promise.resolve({
						error: "Upload failed",
					}),
			} as Response),
		);

		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockFile = createMockFile("file.jpg", "image/jpeg");
		const mockEvent = createMockChangeEvent([mockFile]);

		await act(async () => {
			await result.current.handleFileChange(mockEvent);
		});

		expect(result.current.uploadQueue).toEqual([]);
	});
});

describe("useFileUpload - onAttachmentsChange Callbacks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls onAttachmentsChange with functional updater", async () => {
		const onAttachmentsChange = vi.fn();
		global.fetch = createMockFetch(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						url: "https://example.com/file.jpg",
						pathname: "file.jpg",
						contentType: "image/jpeg",
					}),
			} as Response),
		);

		const { result } = renderHook(() => useFileUpload({ onAttachmentsChange }));

		const mockFile = createMockFile("file.jpg", "image/jpeg");
		const mockEvent = createMockChangeEvent([mockFile]);

		await act(async () => {
			await result.current.handleFileChange(mockEvent);
		});

		expect(onAttachmentsChange).toHaveBeenCalled();
		const callback = onAttachmentsChange.mock.calls[0][0];
		expect(typeof callback).toBe("function");
	});

	it("appends new attachments to existing ones", async () => {
		const existingAttachments: Attachment[] = [
			{
				url: "https://example.com/existing.jpg",
				name: "existing.jpg",
				contentType: "image/jpeg",
			},
		];

		global.fetch = createMockFetch(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						url: "https://example.com/new.jpg",
						pathname: "new.jpg",
						contentType: "image/jpeg",
					}),
			} as Response),
		);

		const { result } = renderHook(() =>
			useFileUpload({
				onAttachmentsChange: (updater) => {
					const newAttachments =
						typeof updater === "function"
							? updater(existingAttachments)
							: updater;
					// Verify the function appends correctly
					expect(newAttachments).toHaveLength(2);
				},
			}),
		);

		const mockFile = createMockFile("new.jpg", "image/jpeg");
		const mockEvent = createMockChangeEvent([mockFile]);

		await act(async () => {
			await result.current.handleFileChange(mockEvent);
		});
	});
});
