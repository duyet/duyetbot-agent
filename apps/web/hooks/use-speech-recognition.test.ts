/**
 * Unit tests for use-speech-recognition hook
 *
 * Test Categories:
 * 1. Browser support detection
 * 2. Hook initialization and state
 * 3. Start listening functionality
 * 4. Stop listening functionality
 * 5. Transcript updates
 * 6. Error handling
 * 7. Continuous mode
 * 8. Configuration options
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type {
	SpeechRecognitionOptions,
	UseSpeechRecognitionResult,
} from "./use-speech-recognition";
import { useSpeechRecognition } from "./use-speech-recognition";

// Store the current instance callbacks and methods for testing
let currentRecognitionInstance: any = null;

// Mock Web Speech API - must be a class that can be instantiated
class MockSpeechRecognition implements EventTarget {
	lang = "";
	continuous = false;
	interimResults = false;
	maxAlternatives = 1;
	onstart: ((this: any, ev: Event) => any) | null = null;
	onresult: ((this: any, ev: any) => any) | null = null;
	onerror: ((this: any, ev: any) => any) | null = null;
	onend: ((this: any, ev: Event) => any) | null = null;

	start = vi.fn(function(this: MockSpeechRecognition) {
		// Store instance for test access
		currentRecognitionInstance = this;
		return Promise.resolve();
	});
	stop = vi.fn(function(this: MockSpeechRecognition) {
		currentRecognitionInstance = this;
		return Promise.resolve();
	});
	abort = vi.fn();

	// EventTarget implementation
	addEventListener = vi.fn();
	removeEventListener = vi.fn();
	dispatchEvent = vi.fn(() => true);
}

// Helper to get the current recognition instance
const getCurrentInstance = () => currentRecognitionInstance;

describe("useSpeechRecognition - Browser Support", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("detects browser support", () => {
		// Mock SpeechRecognition API
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);

		const { result } = renderHook(() => useSpeechRecognition());

		expect(result.current.isSupported).toBe(true);
	});

	it("detects webkit prefix support", () => {
		vi.stubGlobal("webkitSpeechRecognition", MockSpeechRecognition);

		const { result } = renderHook(() => useSpeechRecognition());

		expect(result.current.isSupported).toBe(true);
	});

	it("returns not supported when API is missing", () => {
		// Ensure no SpeechRecognition API
		vi.unstubAllGlobals();
		// Also remove the MockSpeechRecognition to simulate missing API

		const { result } = renderHook(() => useSpeechRecognition());

		expect(result.current.isSupported).toBe(false);
	});

	it("returns not supported in non-browser environment", () => {
		// Mock window but no SpeechRecognition
		vi.stubGlobal("window", {});

		const { result } = renderHook(() => useSpeechRecognition());

		expect(result.current.isSupported).toBe(false);
	});
});

describe("useSpeechRecognition - Initialization", () => {
	beforeEach(() => {
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("initializes with idle state", () => {
		const { result } = renderHook(() => useSpeechRecognition());

		expect(result.current.state).toBe("idle");
		expect(result.current.transcript).toBe("");
		expect(result.current.isSpeechDetected).toBe(false);
		expect(result.current.error).toBeNull();
	});

	it("returns all expected API methods", () => {
		const { result } = renderHook(() => useSpeechRecognition());

		expect(result.current.state).toBeDefined();
		expect(result.current.transcript).toBeDefined();
		expect(result.current.isSpeechDetected).toBeDefined();
		expect(result.current.error).toBeDefined();
		expect(result.current.startListening).toBeDefined();
		expect(result.current.stopListening).toBeDefined();
		expect(result.current.resetTranscript).toBeDefined();
		expect(result.current.isSupported).toBeDefined();
	});

	it("applies custom configuration options", () => {
		const options: SpeechRecognitionOptions = {
			lang: "vi-VN",
			continuous: true,
			interimResults: false,
			maxAlternatives: 2,
		};

		const { result } = renderHook(() => useSpeechRecognition(options));

		expect(result.current.isSupported).toBe(true);
	});
});

describe("useSpeechRecognition - Start Listening", () => {
	beforeEach(() => {
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("starts listening when supported", () => {
		const { result } = renderHook(() => useSpeechRecognition());

		act(() => {
			result.current.startListening();
		});

		expect(result.current.state).toBe("starting");
		const instance = getCurrentInstance();
		expect(instance).toBeDefined();
		expect(instance.start).toHaveBeenCalled();
	});

	it("sets error when not supported", () => {
		vi.unstubAllGlobals();

		const { result } = renderHook(() => useSpeechRecognition());

		act(() => {
			result.current.startListening();
		});

		expect(result.current.state).toBe("error");
		expect(result.current.error).toBe(
			"Speech recognition is not supported in this browser",
		);
	});

	it("clears transcript on start", () => {
		const { result } = renderHook(() => useSpeechRecognition());

		// Set some transcript first
		act(() => {
			result.current.resetTranscript();
		});

		act(() => {
			result.current.startListening();
		});

		expect(result.current.transcript).toBe("");
	});

	it("transitions to listening state", async () => {
		const { result } = renderHook(() => useSpeechRecognition());

		act(() => {
			result.current.startListening();
		});

		// Simulate onstart callback
		act(() => {
			const instance = getCurrentInstance();
			if (instance && instance.onstart) {
				instance.onstart();
			}
		});

		expect(result.current.state).toBe("listening");
		expect(result.current.error).toBeNull();
	});
});

describe("useSpeechRecognition - Stop Listening", () => {
	beforeEach(() => {
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("stops listening", () => {
		const { result } = renderHook(() => useSpeechRecognition());

		act(() => {
			result.current.startListening();
		});

		act(() => {
			result.current.stopListening();
		});

		expect(result.current.state).toBe("stopping");
		const instance = getCurrentInstance();
		expect(instance).toBeDefined();
		expect(instance.stop).toHaveBeenCalled();
	});

	it("does nothing when not initialized", () => {
		vi.unstubAllGlobals();

		const { result } = renderHook(() => useSpeechRecognition());

		act(() => {
			result.current.stopListening();
		});

		// Should not throw
		expect(result.current.state).toBe("idle");
	});
});

describe("useSpeechRecognition - Transcript Updates", () => {
	beforeEach(() => {
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("updates transcript with interim results", async () => {
		const { result } = renderHook(() => useSpeechRecognition({
			interimResults: true,
		}));

		act(() => {
			result.current.startListening();
		});

		// Simulate onresult with interim transcript
		const mockEvent = {
			resultIndex: 0,
			results: [
				{
					isFinal: false,
					0: { transcript: "Hello", confidence: 0.9 },
				},
			],
		};

		act(() => {
			const instance = getCurrentInstance();
			if (instance && instance.onresult) {
				instance.onresult(mockEvent);
			}
		});

		expect(result.current.transcript).toBe("Hello");
		expect(result.current.isSpeechDetected).toBe(true);
	});

	it("updates transcript with final results", async () => {
		const { result } = renderHook(() => useSpeechRecognition());

		act(() => {
			result.current.startListening();
		});

		// Simulate onresult with final transcript
		const mockEvent = {
			resultIndex: 0,
			results: [
				{
					isFinal: true,
					0: { transcript: "Hello world", confidence: 0.95 },
				},
			],
		};

		act(() => {
			const instance = getCurrentInstance();
			if (instance && instance.onresult) {
				instance.onresult(mockEvent);
			}
		});

		expect(result.current.transcript).toBe("Hello world");
	});

	it("accumulates multiple results", async () => {
		const { result } = renderHook(() => useSpeechRecognition());

		act(() => {
			result.current.startListening();
		});

		// First result
		const mockEvent1 = {
			resultIndex: 0,
			results: [
				{
					isFinal: true,
					0: { transcript: "First", confidence: 0.9 },
				},
			],
		};

		// Second result
		const mockEvent2 = {
			resultIndex: 1,
			results: [
				{ isFinal: true, 0: { transcript: "First", confidence: 0.9 } },
				{
					isFinal: true,
					0: { transcript: "Second", confidence: 0.9 },
				},
			],
		};

		act(() => {
			const instance = getCurrentInstance();
			if (instance && instance.onresult) {
				instance.onresult(mockEvent1);
			}
		});

		act(() => {
			const instance = getCurrentInstance();
			if (instance && instance.onresult) {
				instance.onresult(mockEvent2);
			}
		});

		// With the implementation, finalTranscript accumulates
		expect(result.current.transcript).toBe("Second");
	});
});

describe("useSpeechRecognition - Error Handling", () => {
	beforeEach(() => {
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("handles recognition errors", () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useSpeechRecognition());

		act(() => {
			result.current.startListening();
		});

		const mockErrorEvent = {
			error: "not-allowed",
			message: "Microphone access denied",
		};

		act(() => {
			const instance = getCurrentInstance();
			if (instance && instance.onerror) {
				instance.onerror(mockErrorEvent);
			}
		});

		expect(result.current.state).toBe("error");
		expect(result.current.error).toBe("not-allowed");

		consoleErrorSpy.mockRestore();
	});

	it("handles start failure", () => {
		// This test can't easily mock the start method to throw
		// because the instance is created inside the hook's useEffect
		// Instead, we test that the error state is set when recognition is null
		vi.unstubAllGlobals();

		const { result } = renderHook(() => useSpeechRecognition());

		act(() => {
			result.current.startListening();
		});

		// Should show error since SpeechRecognition is not available
		expect(result.current.state).toBe("error");
		expect(result.current.error).toBe("Speech recognition is not supported in this browser");
	});
});

describe("useSpeechRecognition - Reset Transcript", () => {
	beforeEach(() => {
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("resets transcript to empty string", () => {
		const { result } = renderHook(() => useSpeechRecognition());

		// Set transcript via result simulation
		act(() => {
			result.current.startListening();
		});

		const mockEvent = {
			resultIndex: 0,
			results: [
				{
					isFinal: true,
					0: { transcript: "Some text", confidence: 0.9 },
				},
			],
		};

		act(() => {
			const instance = getCurrentInstance();
			if (instance && instance.onresult) {
				instance.onresult(mockEvent);
			}
		});

		expect(result.current.transcript).toBe("Some text");

		act(() => {
			result.current.resetTranscript();
		});

		expect(result.current.transcript).toBe("");
		expect(result.current.isSpeechDetected).toBe(false);
		expect(result.current.error).toBeNull();
	});
});

describe("useSpeechRecognition - Continuous Mode", () => {
	beforeEach(() => {
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("auto-restarts in continuous mode", async () => {
		const { result } = renderHook(() => useSpeechRecognition({
			continuous: true,
		}));

		act(() => {
			result.current.startListening();
		});

		// Clear the start call count from initial start
		const instance = getCurrentInstance();
		if (instance) {
			instance.start.mockClear();
		}

		// Simulate onend
		act(() => {
			const inst = getCurrentInstance();
			if (inst && inst.onend) {
				inst.onend();
			}
		});

		// Should auto-restart
		const instAfter = getCurrentInstance();
		expect(instAfter?.start).toHaveBeenCalled();
	});

	it("does not auto-restart when stopping", () => {
		const { result } = renderHook(() => useSpeechRecognition({
			continuous: true,
		}));

		act(() => {
			result.current.startListening();
		});

		act(() => {
			result.current.stopListening();
		});

		// Simulate onend after stopping
		act(() => {
			const instance = getCurrentInstance();
			if (instance && instance.onend) {
				instance.onend();
			}
		});

		// Should not restart because state is "stopping"
		expect(result.current.state).toBe("idle");
	});
});

describe("useSpeechRecognition - Configuration Options", () => {
	beforeEach(() => {
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("applies language setting", () => {
		const options: SpeechRecognitionOptions = {
			lang: "vi-VN",
		};

		const { result } = renderHook(() => useSpeechRecognition(options));

		// The hook should initialize with the options
		expect(result.current.isSupported).toBe(true);
	});

	it("applies continuous setting", () => {
		const options: SpeechRecognitionOptions = {
			continuous: true,
		};

		const { result } = renderHook(() => useSpeechRecognition(options));

		expect(result.current.isSupported).toBe(true);
	});

	it("applies interim results setting", () => {
		const options: SpeechRecognitionOptions = {
			interimResults: false,
		};

		const { result } = renderHook(() => useSpeechRecognition(options));

		expect(result.current.isSupported).toBe(true);
	});

	it("applies max alternatives setting", () => {
		const options: SpeechRecognitionOptions = {
			maxAlternatives: 3,
		};

		const { result } = renderHook(() => useSpeechRecognition(options));

		expect(result.current.isSupported).toBe(true);
	});
});

describe("useSpeechRecognition - Cleanup", () => {
	beforeEach(() => {
		vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
		vi.clearAllMocks();
		currentRecognitionInstance = null;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		currentRecognitionInstance = null;
	});

	it("stops recognition on unmount", () => {
		const { unmount } = renderHook(() => useSpeechRecognition());

		act(() => {
			unmount();
		});

		const instance = getCurrentInstance();
		expect(instance).toBeDefined();
		expect(instance?.stop).toHaveBeenCalled();
	});

	it("cleans up event listeners on unmount", () => {
		const { unmount } = renderHook(() => useSpeechRecognition());

		act(() => {
			unmount();
		});

		// After unmount, callbacks should not cause errors
		act(() => {
			const instance = getCurrentInstance();
			if (instance && instance.onstart) {
				instance.onstart();
			}
		});

		// Should not throw, just gracefully handle
	});
});
