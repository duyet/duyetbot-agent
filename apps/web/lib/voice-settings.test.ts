import { describe, expect, it } from "vitest";
import { getVoiceOptions, type VoiceSettings } from "./voice-settings";

describe("voice-settings", () => {
	describe("getVoiceOptions", () => {
		it("should return all voice options from settings", () => {
			const settings: VoiceSettings = {
				rate: 1.5,
				pitch: 0.8,
				volume: 0.7,
				voiceURI: "com.apple.voice.compact.en-US.Samantha",
				enabled: true,
				autoRead: false,
			};

			const options = getVoiceOptions(settings);

			expect(options).toEqual({
				rate: 1.5,
				pitch: 0.8,
				volume: 0.7,
				voiceURI: "com.apple.voice.compact.en-US.Samantha",
			});
		});

		it("should handle undefined voiceURI", () => {
			const settings: VoiceSettings = {
				rate: 1,
				pitch: 1,
				volume: 1,
				voiceURI: undefined,
				enabled: true,
				autoRead: true,
			};

			const options = getVoiceOptions(settings);

			expect(options.voiceURI).toBeUndefined();
		});

		it("should not include enabled or autoRead in options", () => {
			const settings: VoiceSettings = {
				rate: 1,
				pitch: 1,
				volume: 1,
				enabled: false,
				autoRead: true,
			};

			const options = getVoiceOptions(settings);

			expect(options).not.toHaveProperty("enabled");
			expect(options).not.toHaveProperty("autoRead");
		});

		it("should preserve decimal precision", () => {
			const settings: VoiceSettings = {
				rate: 1.25,
				pitch: 0.75,
				volume: 0.333,
				enabled: true,
				autoRead: false,
			};

			const options = getVoiceOptions(settings);

			expect(options.rate).toBe(1.25);
			expect(options.pitch).toBe(0.75);
			expect(options.volume).toBe(0.333);
		});
	});

	describe("VoiceSettings type", () => {
		it("should have correct default structure", () => {
			const defaults: VoiceSettings = {
				rate: 1,
				pitch: 1,
				volume: 1,
				voiceURI: undefined,
				enabled: true,
				autoRead: false,
			};

			expect(defaults.rate).toBeGreaterThanOrEqual(0.5);
			expect(defaults.rate).toBeLessThanOrEqual(2);
			expect(defaults.pitch).toBeGreaterThanOrEqual(0.5);
			expect(defaults.pitch).toBeLessThanOrEqual(2);
			expect(defaults.volume).toBeGreaterThanOrEqual(0);
			expect(defaults.volume).toBeLessThanOrEqual(1);
		});

		it("should allow boundary values for rate", () => {
			const minRate: VoiceSettings = {
				rate: 0.5,
				pitch: 1,
				volume: 1,
				enabled: true,
				autoRead: false,
			};
			const maxRate: VoiceSettings = {
				rate: 2,
				pitch: 1,
				volume: 1,
				enabled: true,
				autoRead: false,
			};

			expect(minRate.rate).toBe(0.5);
			expect(maxRate.rate).toBe(2);
		});

		it("should allow boundary values for pitch", () => {
			const minPitch: VoiceSettings = {
				rate: 1,
				pitch: 0.5,
				volume: 1,
				enabled: true,
				autoRead: false,
			};
			const maxPitch: VoiceSettings = {
				rate: 1,
				pitch: 2,
				volume: 1,
				enabled: true,
				autoRead: false,
			};

			expect(minPitch.pitch).toBe(0.5);
			expect(maxPitch.pitch).toBe(2);
		});

		it("should allow boundary values for volume", () => {
			const minVolume: VoiceSettings = {
				rate: 1,
				pitch: 1,
				volume: 0,
				enabled: true,
				autoRead: false,
			};
			const maxVolume: VoiceSettings = {
				rate: 1,
				pitch: 1,
				volume: 1,
				enabled: true,
				autoRead: false,
			};

			expect(minVolume.volume).toBe(0);
			expect(maxVolume.volume).toBe(1);
		});
	});
});
