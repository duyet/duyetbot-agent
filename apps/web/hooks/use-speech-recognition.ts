/**
 * Web Speech API - Speech Recognition Hook
 *
 * Provides voice-to-text functionality using the browser's Web Speech API.
 * Supports continuous dictation with automatic result handling.
 *
 * Browser Support:
 * - Chrome/Edge: Full support
 * - Safari: Partial support (requires user interaction)
 * - Firefox: Not supported (requires configuration)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionState =
	| "idle"
	| "starting"
	| "listening"
	| "stopping"
	| "error";

export interface SpeechRecognitionOptions {
	/** Language code (default: "en-US") */
	lang?: string;
	/** Continuous recognition (default: false) */
	continuous?: boolean;
	/** Interim results (default: true) */
	interimResults?: boolean;
	/** Max alternatives (default: 1) */
	maxAlternatives?: number;
}

export interface UseSpeechRecognitionResult {
	/** Current state of the recognition */
	state: SpeechRecognitionState;
	/** Transcribed text from speech */
	transcript: string;
	/** Whether speech is currently being detected */
	isSpeechDetected: boolean;
	/** Error message if recognition failed */
	error: string | null;
	/** Start listening */
	startListening: () => void;
	/** Stop listening */
	stopListening: () => void;
	/** Reset transcript */
	resetTranscript: () => void;
	/** Whether speech recognition is supported */
	isSupported: boolean;
}

// Check for browser support
const checkSupport = (): boolean => {
	return (
		typeof window !== "undefined" &&
		("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
	);
};

export function useSpeechRecognition(
	options: SpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
	const {
		lang = "en-US",
		continuous = false,
		interimResults = true,
		maxAlternatives = 1,
	} = options;

	const [state, setState] = useState<SpeechRecognitionState>("idle");
	const [transcript, setTranscript] = useState("");
	const [isSpeechDetected, setIsSpeechDetected] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const recognitionRef = useRef<LocalSpeechRecognition | null>(null);
	const stateRef = useRef(state);
	const isSupported = checkSupport();

	// Keep ref in sync with state for use in event handlers
	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	// Initialize recognition
	useEffect(() => {
		if (!isSupported) return;

		const SpeechRecognitionAPI =
			(window as any).SpeechRecognition ||
			(window as any).webkitSpeechRecognition;

		if (!SpeechRecognitionAPI) return;

		const recognition = new SpeechRecognitionAPI();
		recognition.lang = lang;
		recognition.continuous = continuous;
		recognition.interimResults = interimResults;
		recognition.maxAlternatives = maxAlternatives;

		recognition.onstart = () => {
			setState("listening");
			setError(null);
		};

		recognition.onresult = (event: LocalSpeechRecognitionEvent) => {
			let interimTranscript = "";
			let finalTranscript = "";

			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const transcript = result[0].transcript;

				if (result.isFinal) {
					finalTranscript += transcript;
				} else {
					interimTranscript += transcript;
				}
			}

			setTranscript(finalTranscript || interimTranscript);
			setIsSpeechDetected(event.results.length > 0);
		};

		recognition.onerror = (event: LocalSpeechRecognitionErrorEvent) => {
			console.error("Speech recognition error:", event.error);
			setError(event.error);
			setState("error");
		};

		recognition.onend = () => {
			if (stateRef.current === "stopping") {
				setState("idle");
			} else if (continuous) {
				// Auto-restart for continuous mode
				try {
					recognition.start();
				} catch {
					setState("idle");
				}
			} else {
				setState("idle");
			}
		};

		recognitionRef.current = recognition;

		return () => {
			recognition.stop();
			recognitionRef.current = null;
		};
	}, [lang, continuous, interimResults, maxAlternatives, isSupported]);

	const startListening = useCallback(() => {
		if (!isSupported) {
			setError("Speech recognition is not supported in this browser");
			setState("error");
			return;
		}

		if (!recognitionRef.current) {
			setError("Speech recognition not initialized");
			setState("error");
			return;
		}

		try {
			setState("starting");
			setTranscript("");
			recognitionRef.current.start();
		} catch (err) {
			console.error("Failed to start speech recognition:", err);
			setError("Failed to start listening");
			setState("error");
		}
	}, [isSupported]);

	const stopListening = useCallback(() => {
		if (recognitionRef.current) {
			setState("stopping");
			recognitionRef.current.stop();
		}
	}, []);

	const resetTranscript = useCallback(() => {
		setTranscript("");
		setIsSpeechDetected(false);
		setError(null);
	}, []);

	return {
		state,
		transcript,
		isSpeechDetected,
		error,
		startListening,
		stopListening,
		resetTranscript,
		isSupported,
	};
}

// Local type declarations for Web Speech API to avoid DOM lib conflicts
// These are locally scoped to prevent module augmentation issues

interface LocalSpeechRecognitionEvent extends Event {
	resultIndex: number;
	results: LocalSpeechRecognitionResultList;
}

interface LocalSpeechRecognitionResultList {
	readonly length: number;
	item(index: number): LocalSpeechRecognitionResult;
	[index: number]: LocalSpeechRecognitionResult;
}

interface LocalSpeechRecognitionResult {
	isFinal: boolean;
	readonly length: number;
	item(index: number): LocalSpeechRecognitionAlternative;
	[index: number]: LocalSpeechRecognitionAlternative;
}

interface LocalSpeechRecognitionAlternative {
	transcript: string;
	confidence: number;
}

interface LocalSpeechRecognitionErrorEvent extends Event {
	error: string;
	message: string;
}

interface LocalSpeechRecognition extends EventTarget {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	onstart: ((this: LocalSpeechRecognition, ev: Event) => void) | null;
	onresult:
		| ((this: LocalSpeechRecognition, ev: LocalSpeechRecognitionEvent) => void)
		| null;
	onerror:
		| ((
				this: LocalSpeechRecognition,
				ev: LocalSpeechRecognitionErrorEvent,
		  ) => void)
		| null;
	onend: ((this: LocalSpeechRecognition, ev: Event) => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}
