"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Voice Settings System
 *
 * Allows users to customize text-to-speech settings including:
 * - Speech rate (speed)
 * - Pitch
 * - Volume
 * - Voice selection
 */

export interface VoiceSettings {
	/** Speaking rate (0.5 to 2, default: 1) */
	rate: number;
	/** Pitch (0.5 to 2, default: 1) */
	pitch: number;
	/** Volume (0 to 1, default: 1) */
	volume: number;
	/** Selected voice URI (optional, uses system default if not set) */
	voiceURI?: string;
	/** Whether TTS is enabled globally */
	enabled: boolean;
	/** Automatically read new AI messages */
	autoRead: boolean;
}

const STORAGE_KEY = "voice-settings";

const DEFAULT_SETTINGS: VoiceSettings = {
	rate: 1,
	pitch: 1,
	volume: 1,
	voiceURI: undefined,
	enabled: true,
	autoRead: false,
};

/**
 * Hook for managing voice settings with localStorage persistence
 */
export function useVoiceSettings() {
	const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
	const [isLoaded, setIsLoaded] = useState(false);

	// Load settings from localStorage on mount
	useEffect(() => {
		if (typeof window === "undefined") return;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as Partial<VoiceSettings>;
				setSettings({ ...DEFAULT_SETTINGS, ...parsed });
			}
		} catch (error) {
			console.error("Failed to load voice settings:", error);
		}
		setIsLoaded(true);
	}, []);

	// Persist settings to localStorage
	const saveSettings = useCallback((newSettings: VoiceSettings) => {
		if (typeof window === "undefined") return;

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
			setSettings(newSettings);
		} catch (error) {
			console.error("Failed to save voice settings:", error);
		}
	}, []);

	// Update individual settings
	const updateRate = useCallback(
		(rate: number) => {
			saveSettings({ ...settings, rate: Math.max(0.5, Math.min(2, rate)) });
		},
		[settings, saveSettings],
	);

	const updatePitch = useCallback(
		(pitch: number) => {
			saveSettings({ ...settings, pitch: Math.max(0.5, Math.min(2, pitch)) });
		},
		[settings, saveSettings],
	);

	const updateVolume = useCallback(
		(volume: number) => {
			saveSettings({ ...settings, volume: Math.max(0, Math.min(1, volume)) });
		},
		[settings, saveSettings],
	);

	const updateVoice = useCallback(
		(voiceURI: string | undefined) => {
			saveSettings({ ...settings, voiceURI });
		},
		[settings, saveSettings],
	);

	const setEnabled = useCallback(
		(enabled: boolean) => {
			saveSettings({ ...settings, enabled });
		},
		[settings, saveSettings],
	);

	const setAutoRead = useCallback(
		(autoRead: boolean) => {
			saveSettings({ ...settings, autoRead });
		},
		[settings, saveSettings],
	);

	const resetSettings = useCallback(() => {
		saveSettings(DEFAULT_SETTINGS);
	}, [saveSettings]);

	return {
		settings,
		isLoaded,
		updateRate,
		updatePitch,
		updateVolume,
		updateVoice,
		setEnabled,
		setAutoRead,
		resetSettings,
	};
}

/**
 * Get voice settings as SpeechSynthesisOptions
 */
export function getVoiceOptions(settings: VoiceSettings) {
	return {
		rate: settings.rate,
		pitch: settings.pitch,
		volume: settings.volume,
		voiceURI: settings.voiceURI,
	};
}
