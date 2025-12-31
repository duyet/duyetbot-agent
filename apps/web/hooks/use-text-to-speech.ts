/**
 * Web Speech API - Text-to-Speech Hook
 *
 * Provides text-to-speech functionality using the browser's Speech Synthesis API.
 * Supports voice selection, rate, pitch, and volume controls.
 *
 * Browser Support:
 * - Chrome/Edge: Full support
 * - Safari: Full support
 * - Firefox: Full support
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechSynthesisState = "idle" | "playing" | "paused" | "error";

export interface SpeechSynthesisOptions {
	/** Voice URI (if not specified, uses default) */
	voiceURI?: string;
	/** Speaking rate (0.1 to 10, default: 1) */
	rate?: number;
	/** Pitch (0 to 2, default: 1) */
	pitch?: number;
	/** Volume (0 to 1, default: 1) */
	volume?: number;
	/** Language code (default: "en-US") */
	lang?: string;
}

export interface UseSpeechSynthesisResult {
	/** Current state of the speech synthesis */
	state: SpeechSynthesisState;
	/** Available voices */
	voices: SpeechSynthesisVoice[];
	/** Whether currently speaking */
	isSpeaking: boolean;
	/** Error message if synthesis failed */
	error: string | null;
	/** Speak text */
	speak: (text: string, options?: SpeechSynthesisOptions) => void;
	/** Pause speaking */
	pause: () => void;
	/** Resume speaking */
	resume: () => void;
	/** Cancel speaking */
	cancel: () => void;
	/** Whether speech synthesis is supported */
	isSupported: boolean;
}

// Check for browser support
const checkSupport = (): boolean => {
	return typeof window !== "undefined" && "speechSynthesis" in window;
};

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
	const [state, setState] = useState<SpeechSynthesisState>("idle");
	const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const isSupported = checkSupport();

	// Load available voices
	useEffect(() => {
		if (!isSupported) return;

		const loadVoices = () => {
			const availableVoices = speechSynthesis.getVoices();
			setVoices(availableVoices);
		};

		// Load voices immediately
		loadVoices();

		// Voices load asynchronously in some browsers
		speechSynthesis.onvoiceschanged = loadVoices;

		return () => {
			speechSynthesis.onvoiceschanged = null;
		};
	}, [isSupported]);

	const speak = useCallback(
		(text: string, options: SpeechSynthesisOptions = {}) => {
			if (!isSupported) {
				setError("Speech synthesis is not supported in this browser");
				setState("error");
				return;
			}

			if (!text || text.trim().length === 0) {
				setError("Cannot speak empty text");
				setState("error");
				return;
			}

			// Cancel any ongoing speech
			speechSynthesis.cancel();

			const utterance = new SpeechSynthesisUtterance(text);

			// Apply options
			if (options.voiceURI) {
				const voice = voices.find((v) => v.voiceURI === options.voiceURI);
				if (voice) utterance.voice = voice;
			}
			if (options.rate) utterance.rate = options.rate;
			if (options.pitch) utterance.pitch = options.pitch;
			if (options.volume) utterance.volume = options.volume;
			if (options.lang) utterance.lang = options.lang;

			// Event handlers
			utterance.onstart = () => {
				setState("playing");
				setIsSpeaking(true);
				setError(null);
			};

			utterance.onend = () => {
				setState("idle");
				setIsSpeaking(false);
			};

			utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
				console.error("Speech synthesis error:", event);
				setError(event.error || "Unknown speech synthesis error");
				setState("error");
				setIsSpeaking(false);
			};

			utterance.onpause = () => {
				setState("paused");
			};

			utterance.onresume = () => {
				setState("playing");
			};

			utteranceRef.current = utterance;
			speechSynthesis.speak(utterance);
		},
		[isSupported, voices],
	);

	const pause = useCallback(() => {
		if (isSupported && state === "playing") {
			speechSynthesis.pause();
		}
	}, [isSupported, state]);

	const resume = useCallback(() => {
		if (isSupported && state === "paused") {
			speechSynthesis.resume();
		}
	}, [isSupported, state]);

	const cancel = useCallback(() => {
		if (isSupported) {
			speechSynthesis.cancel();
			setState("idle");
			setIsSpeaking(false);
		}
	}, [isSupported]);

	return {
		state,
		voices,
		isSpeaking,
		error,
		speak,
		pause,
		resume,
		cancel,
		isSupported,
	};
}

// Type declarations for Speech Synthesis API
interface SpeechSynthesisErrorEvent extends Event {
	error: string;
	utterance: SpeechSynthesisUtterance;
}

interface SpeechSynthesisVoice {
	voiceURI: string;
	name: string;
	lang: string;
	localService: boolean;
	default: boolean;
}

declare var speechSynthesis: {
	speak(utterance: SpeechSynthesisUtterance): void;
	cancel(): void;
	pause(): void;
	resume(): void;
	getVoices(): SpeechSynthesisVoice[];
	onvoiceschanged: (() => void) | null;
};
