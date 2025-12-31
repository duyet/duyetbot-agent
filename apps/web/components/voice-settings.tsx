"use client";

import { RotateCcwIcon, Volume2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSpeechSynthesis } from "@/hooks/use-text-to-speech";
import { useVoiceSettings } from "@/lib/voice-settings";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";

/**
 * Voice Settings Dialog
 *
 * Provides UI for customizing text-to-speech settings:
 * - Rate (speed)
 * - Pitch
 * - Volume
 * - Voice selection
 */
export function VoiceSettings() {
	const [open, setOpen] = useState(false);
	const { voices, speak, cancel, isSpeaking, isSupported } =
		useSpeechSynthesis();
	const {
		settings,
		updateRate,
		updatePitch,
		updateVolume,
		updateVoice,
		setEnabled,
		setAutoRead,
		resetSettings,
	} = useVoiceSettings();

	const handleTestVoice = () => {
		if (isSpeaking) {
			cancel();
			return;
		}

		speak("Hello! This is a preview of your voice settings.", {
			rate: settings.rate,
			pitch: settings.pitch,
			volume: settings.volume,
			voiceURI: settings.voiceURI,
		});
	};

	const handleReset = () => {
		resetSettings();
		toast.success("Voice settings reset to defaults");
	};

	if (!isSupported) {
		return null;
	}

	// Group voices by language
	const voicesByLang = voices.reduce(
		(acc, voice) => {
			const lang = voice.lang.split("-")[0];
			if (!acc[lang]) acc[lang] = [];
			acc[lang].push(voice);
			return acc;
		},
		{} as Record<string, SpeechSynthesisVoice[]>,
	);

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<Button
					aria-label="Voice settings"
					className="gap-2"
					size="sm"
					variant="ghost"
				>
					<Volume2Icon className="size-4" />
					<span className="hidden sm:inline">Voice</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Volume2Icon className="size-5" />
						Voice Settings
					</DialogTitle>
					<DialogDescription>
						Customize text-to-speech for AI responses.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[60vh]">
					<div className="space-y-6 px-1 pr-4">
						{/* Enable Toggle */}
						<div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
							<div className="space-y-0.5">
								<Label className="text-base" htmlFor="enable-voice">
									Enable Text-to-Speech
								</Label>
								<p className="text-muted-foreground text-sm">
									Show the read aloud button on messages
								</p>
							</div>
							<Switch
								checked={settings.enabled}
								id="enable-voice"
								onCheckedChange={setEnabled}
							/>
						</div>

						{/* Auto-Read Toggle */}
						<div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
							<div className="space-y-0.5">
								<Label className="text-base" htmlFor="auto-read">
									Auto-Read Responses
								</Label>
								<p className="text-muted-foreground text-sm">
									Automatically read new AI messages aloud
								</p>
							</div>
							<Switch
								checked={settings.autoRead}
								disabled={!settings.enabled}
								id="auto-read"
								onCheckedChange={setAutoRead}
							/>
						</div>

						{/* Voice Selection */}
						<div className="space-y-3">
							<Label htmlFor="voice-select">Voice</Label>
							<Select
								onValueChange={(value) =>
									updateVoice(value === "default" ? undefined : value)
								}
								value={settings.voiceURI ?? "default"}
							>
								<SelectTrigger id="voice-select">
									<SelectValue placeholder="System default" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="default">System default</SelectItem>
									{Object.entries(voicesByLang).map(([lang, langVoices]) => (
										<div key={lang}>
											<div className="px-2 py-1.5 font-medium text-muted-foreground text-xs uppercase">
												{lang}
											</div>
											{langVoices.map((voice) => (
												<SelectItem key={voice.voiceURI} value={voice.voiceURI}>
													{voice.name}
													{voice.localService && " (Local)"}
												</SelectItem>
											))}
										</div>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Rate Slider */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label htmlFor="rate-slider">Speed</Label>
								<span className="text-muted-foreground text-sm tabular-nums">
									{settings.rate.toFixed(1)}x
								</span>
							</div>
							<Slider
								aria-label="Speech rate"
								id="rate-slider"
								max={2}
								min={0.5}
								onValueChange={([value]) => updateRate(value)}
								step={0.1}
								value={[settings.rate]}
							/>
							<p className="text-muted-foreground text-xs">
								Adjust how fast the voice speaks (0.5x - 2x)
							</p>
						</div>

						{/* Pitch Slider */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label htmlFor="pitch-slider">Pitch</Label>
								<span className="text-muted-foreground text-sm tabular-nums">
									{settings.pitch.toFixed(1)}
								</span>
							</div>
							<Slider
								aria-label="Speech pitch"
								id="pitch-slider"
								max={2}
								min={0.5}
								onValueChange={([value]) => updatePitch(value)}
								step={0.1}
								value={[settings.pitch]}
							/>
							<p className="text-muted-foreground text-xs">
								Adjust the voice pitch (0.5 - 2.0)
							</p>
						</div>

						{/* Volume Slider */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label htmlFor="volume-slider">Volume</Label>
								<span className="text-muted-foreground text-sm tabular-nums">
									{Math.round(settings.volume * 100)}%
								</span>
							</div>
							<Slider
								aria-label="Speech volume"
								id="volume-slider"
								max={1}
								min={0}
								onValueChange={([value]) => updateVolume(value)}
								step={0.05}
								value={[settings.volume]}
							/>
							<p className="text-muted-foreground text-xs">
								Adjust the playback volume (0% - 100%)
							</p>
						</div>

						{/* Test Button */}
						<div className="pt-2">
							<Button
								className="w-full gap-2"
								onClick={handleTestVoice}
								variant="outline"
							>
								<Volume2Icon className="size-4" />
								{isSpeaking ? "Stop Preview" : "Test Voice"}
							</Button>
						</div>
					</div>
				</ScrollArea>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						className="gap-2"
						onClick={handleReset}
						type="button"
						variant="ghost"
					>
						<RotateCcwIcon className="size-4" />
						Reset
					</Button>
					<Button onClick={() => setOpen(false)} type="button">
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
