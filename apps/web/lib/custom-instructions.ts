"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Custom Instructions System
 *
 * Allows users to customize AI behavior by setting persistent system instructions.
 * These are appended to the base system prompt for every chat.
 */

/**
 * Custom instruction template
 */
export interface InstructionTemplate {
	id: string;
	name: string;
	description: string;
	instruction: string;
	category: "coding" | "writing" | "analysis" | "general" | "custom";
}

/**
 * User's custom instructions
 */
export interface CustomInstructions {
	global: string; // Applied to all chats
	chatSpecific: Record<string, string>; // Per-chat instructions
	enabled: boolean; // Master switch
	activeTemplate?: string; // Currently selected template ID
}

/**
 * AI generation settings
 */
export interface AISettings {
	temperature: number; // 0-2, controls randomness
	maxTokens?: number; // Maximum response length
	topP?: number; // Nucleus sampling
	frequencyPenalty?: number; // -2 to 2
	presencePenalty?: number; // -2 to 2
}

const STORAGE_KEY = "custom-instructions";
const AI_SETTINGS_KEY = "ai-settings";

/**
 * Built-in instruction templates
 */
export const INSTRUCTION_TEMPLATES: InstructionTemplate[] = [
	{
		id: "coding-assistant",
		name: "Coding Assistant",
		description: "Focus on clean, well-documented code with best practices",
		category: "coding",
		instruction: `You are an expert software engineer. When writing code:
- Prioritize readability and maintainability
- Add helpful comments for complex logic
- Follow language-specific best practices
- Include error handling and edge cases
- Suggest tests for critical functions
- Explain trade-offs when multiple approaches exist`,
	},
	{
		id: "concise-coder",
		name: "Concise Coder",
		description: "Brief, direct answers with minimal explanation",
		category: "coding",
		instruction: `Provide direct, concise answers:
- Get straight to the solution
- Minimal commentary
- Code-first approach
- Assume the reader is technically proficient`,
	},
	{
		id: "code-reviewer",
		name: "Code Reviewer",
		description: "Focus on identifying bugs, security issues, and improvements",
		category: "coding",
		instruction: `You are a thorough code reviewer. Analyze code for:
- Security vulnerabilities (injection, XSS, CSRF, etc.)
- Performance bottlenecks
- Edge cases and error handling
- Code organization and readability
- Adherence to best practices
Provide specific, actionable feedback.`,
	},
	{
		id: "technical-writer",
		name: "Technical Writer",
		description: "Clear explanations with examples for documentation",
		category: "writing",
		instruction: `You are a technical documentation expert. When explaining:
- Start with a clear overview
- Use concrete examples
- Include code snippets with expected output
- Link to relevant documentation
- Anticipate common questions
- Use formatting (headers, lists, code blocks) for clarity`,
	},
	{
		id: "creative-writer",
		name: "Creative Writer",
		description: "Engaging, creative content with vivid descriptions",
		category: "writing",
		instruction: `You are a creative writing assistant. When creating content:
- Use vivid, sensory language
- Show rather than tell
- Vary sentence structure for rhythm
- Evoke emotion and imagery
- Consider pacing and flow
- Adapt tone to the context`,
	},
	{
		id: "data-analyst",
		name: "Data Analyst",
		description: "Focus on data interpretation, patterns, and insights",
		category: "analysis",
		instruction: `You are a data analyst. When analyzing information:
- Identify patterns and trends
- Highlight outliers and anomalies
- Provide context for statistics
- Suggest visualizations when helpful
- Distinguish correlation from causation
- Quantify uncertainty when applicable`,
	},
	{
		id: "research-assistant",
		name: "Research Assistant",
		description: "Thorough, well-sourced analysis with critical thinking",
		category: "analysis",
		instruction: `You are a research assistant. When investigating:
- Consider multiple perspectives
- Distinguish established facts from hypotheses
- Identify knowledge gaps
- Suggest reliable sources
- Note methodological limitations
- Present balanced conclusions`,
	},
	{
		id: "tutor",
		name: "Learning Tutor",
		description:
			"Educational explanations that build understanding step by step",
		category: "general",
		instruction: `You are a patient tutor. When teaching:
- Assess current understanding first
- Break complex topics into steps
- Use analogies and examples
- Check for comprehension
- Encourage questions
- Build on existing knowledge
- Adapt to learning pace`,
	},
	{
		id: "pro-editor",
		name: "Professional Editor",
		description: "Polished, professional writing with grammar and style focus",
		category: "writing",
		instruction: `You are a professional editor. When editing text:
- Correct grammar and spelling
- Improve clarity and concision
- Enhance flow and coherence
- Maintain author's voice
- Suggest stylistic improvements
- Flag potentially confusing phrasing`,
	},
];

/**
 * Default AI settings
 */
export const DEFAULT_AI_SETTINGS: AISettings = {
	temperature: 0.7,
	maxTokens: undefined,
	topP: undefined,
	frequencyPenalty: undefined,
	presencePenalty: undefined,
};

/**
 * Get custom instructions from storage
 */
export function getCustomInstructions(): CustomInstructions {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (error) {
		console.error("[CustomInstructions] Failed to load:", error);
	}

	return {
		global: "",
		chatSpecific: {},
		enabled: false,
	};
}

/**
 * Save custom instructions to storage
 */
export function saveCustomInstructions(instructions: CustomInstructions): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(instructions));

		// Dispatch event for UI updates
		window.dispatchEvent(
			new CustomEvent("custom-instructions-change", {
				detail: instructions,
			}),
		);
	} catch (error) {
		console.error("[CustomInstructions] Failed to save:", error);
	}
}

/**
 * Get AI settings from storage
 */
export function getAISettings(): AISettings {
	try {
		const stored = localStorage.getItem(AI_SETTINGS_KEY);
		if (stored) {
			return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(stored) };
		}
	} catch (error) {
		console.error("[AISettings] Failed to load:", error);
	}

	return { ...DEFAULT_AI_SETTINGS };
}

/**
 * Save AI settings to storage
 */
export function saveAISettings(settings: AISettings): void {
	try {
		localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));

		// Dispatch event for UI updates
		window.dispatchEvent(
			new CustomEvent("ai-settings-change", {
				detail: settings,
			}),
		);
	} catch (error) {
		console.error("[AISettings] Failed to save:", error);
	}
}

/**
 * Get effective instructions for a chat
 * Combines global and chat-specific instructions
 */
export function getEffectiveInstructions(chatId?: string): string {
	const instructions = getCustomInstructions();

	if (!instructions.enabled) {
		return "";
	}

	const parts: string[] = [];

	// Add global instructions
	if (instructions.global.trim()) {
		parts.push(instructions.global.trim());
	}

	// Add chat-specific instructions
	if (chatId && instructions.chatSpecific[chatId]) {
		const chatSpecific = instructions.chatSpecific[chatId].trim();
		if (chatSpecific) {
			parts.push(chatSpecific);
		}
	}

	// Add template instructions if active
	if (instructions.activeTemplate) {
		const template = INSTRUCTION_TEMPLATES.find(
			(t) => t.id === instructions.activeTemplate,
		);
		if (template) {
			parts.push(template.instruction.trim());
		}
	}

	return parts.join("\n\n");
}

/**
 * Set global instructions
 */
export function setGlobalInstructions(instructions: string): void {
	const current = getCustomInstructions();
	current.global = instructions;
	saveCustomInstructions(current);
}

/**
 * Set chat-specific instructions
 */
export function setChatInstructions(
	chatId: string,
	instructions: string,
): void {
	const current = getCustomInstructions();

	if (instructions.trim()) {
		current.chatSpecific[chatId] = instructions;
	} else {
		delete current.chatSpecific[chatId];
	}

	saveCustomInstructions(current);
}

/**
 * Enable or disable custom instructions
 */
export function setInstructionsEnabled(enabled: boolean): void {
	const current = getCustomInstructions();
	current.enabled = enabled;
	saveCustomInstructions(current);
}

/**
 * Set active template
 */
export function setActiveTemplate(templateId: string | undefined): void {
	const current = getCustomInstructions();
	current.activeTemplate = templateId;
	saveCustomInstructions(current);
}

/**
 * Clear all custom instructions
 */
export function clearCustomInstructions(): void {
	saveCustomInstructions({
		global: "",
		chatSpecific: {},
		enabled: false,
	});
}

/**
 * Reset AI settings to defaults
 */
export function resetAISettings(): void {
	saveAISettings({ ...DEFAULT_AI_SETTINGS });
}

/**
 * Hook for managing custom instructions
 */
export function useCustomInstructions() {
	const [instructions, setInstructions] = useState<CustomInstructions>(
		getCustomInstructions(),
	);
	const [aiSettings, setAISettingsState] = useState<AISettings>(
		getAISettings(),
	);

	// Listen for changes from other tabs
	useEffect(() => {
		const handleInstructionsChange = (e: Event) => {
			const customEvent = e as CustomEvent<CustomInstructions>;
			setInstructions(customEvent.detail);
		};

		const handleAISettingsChange = (e: Event) => {
			const customEvent = e as CustomEvent<AISettings>;
			setAISettingsState(customEvent.detail);
		};

		window.addEventListener(
			"custom-instructions-change",
			handleInstructionsChange,
		);
		window.addEventListener("ai-settings-change", handleAISettingsChange);

		return () => {
			window.removeEventListener(
				"custom-instructions-change",
				handleInstructionsChange,
			);
			window.removeEventListener("ai-settings-change", handleAISettingsChange);
		};
	}, []);

	const updateGlobal = useCallback((text: string) => {
		setGlobalInstructions(text);
		setInstructions((prev) => ({ ...prev, global: text }));
	}, []);

	const updateChat = useCallback((chatId: string, text: string) => {
		setChatInstructions(chatId, text);
		setInstructions((prev) => {
			const updated = { ...prev, chatSpecific: { ...prev.chatSpecific } };
			if (text.trim()) {
				updated.chatSpecific[chatId] = text;
			} else {
				delete updated.chatSpecific[chatId];
			}
			return updated;
		});
	}, []);

	const setEnabled = useCallback((enabled: boolean) => {
		setInstructionsEnabled(enabled);
		setInstructions((prev) => ({ ...prev, enabled }));
	}, []);

	const setActiveTemplate = useCallback((templateId: string | undefined) => {
		setActiveTemplate(templateId);
		setInstructions((prev) => ({ ...prev, activeTemplate: templateId }));
	}, []);

	const clear = useCallback(() => {
		clearCustomInstructions();
		setInstructions({
			global: "",
			chatSpecific: {},
			enabled: false,
		});
	}, []);

	const updateAISettings = useCallback(
		(settings: Partial<AISettings>) => {
			const updated = { ...aiSettings, ...settings };
			saveAISettings(updated);
			setAISettingsState(updated);
		},
		[aiSettings],
	);

	const resetSettings = useCallback(() => {
		resetAISettings();
		setAISettingsState({ ...DEFAULT_AI_SETTINGS });
	}, []);

	return {
		instructions,
		aiSettings,
		updateGlobal,
		updateChat,
		setEnabled,
		setActiveTemplate,
		clear,
		updateAISettings,
		resetSettings,
	};
}
