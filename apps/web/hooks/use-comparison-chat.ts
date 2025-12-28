/**
 * Hook for Model Comparison Mode
 *
 * Manages state for comparing responses from multiple AI models side-by-side.
 * Sends the same prompt to multiple models in parallel and tracks their responses.
 */

import { useChat } from "@ai-sdk/react";
import { useCallback, useMemo, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

export type ComparisonModel = {
	id: string;
	name: string;
};

export type ComparisonResult = {
	modelId: string;
	modelName: string;
	messages: ChatMessage[];
	status: "idle" | "streaming" | "complete" | "error";
	error?: Error;
	startTime?: number;
	endTime?: number;
	duration?: number;
};

export type UseComparisonChatOptions = {
	models: ComparisonModel[];
	onComplete?: (results: ComparisonResult[]) => void;
};

export type ComparisonChatState = {
	isComparing: boolean;
	results: ComparisonResult[];
	prompt: string;
	startComparison: (prompt: string) => void;
	stopComparison: () => void;
	reset: () => void;
};

/**
 * Hook for managing multiple parallel chat streams for model comparison
 *
 * @example
 * const { results, startComparison, isComparing } = useComparisonChat({
 *   models: [
 *     { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
 *     { id: 'openai/gpt-4o', name: 'GPT-4o' },
 *   ],
 * });
 *
 * // Start comparison
 * startComparison("Explain quantum computing in simple terms");
 */
export function useComparisonChat({
	models,
	onComplete,
}: UseComparisonChatOptions): ComparisonChatState {
	const [prompt, setPrompt] = useState("");
	const [isComparing, setIsComparing] = useState(false);
	const [results, setResults] = useState<ComparisonResult[]>([]);

	// Initialize results for each model
	const initializeResults = useCallback(() => {
		return models.map((model) => ({
			modelId: model.id,
			modelName: model.name,
			messages: [],
			status: "idle" as const,
		}));
	}, [models]);

	// Update a specific model's result
	const updateResult = useCallback(
		(modelId: string, update: Partial<ComparisonResult>) => {
			setResults((prev) =>
				prev.map((r) => (r.modelId === modelId ? { ...r, ...update } : r)),
			);
		},
		[],
	);

	// Start comparison with a prompt
	const startComparison = useCallback(
		async (newPrompt: string) => {
			if (!newPrompt.trim() || models.length === 0) return;

			setPrompt(newPrompt);
			setIsComparing(true);
			setResults(
				models.map((model) => ({
					modelId: model.id,
					modelName: model.name,
					messages: [],
					status: "streaming" as const,
					startTime: Date.now(),
				})),
			);

			// Create parallel requests for each model
			const completionPromises = models.map(async (model) => {
				const chatId = generateUUID();
				const messageId = generateUUID();

				try {
					const response = await fetch("/api/chat", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							id: chatId,
							message: {
								id: messageId,
								role: "user",
								parts: [{ type: "text" as const, text: newPrompt }],
							},
							selectedChatModel: model.id,
							selectedVisibilityType: "private",
						}),
					});

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}

					// Read the stream
					const reader = response.body?.getReader();
					if (!reader) throw new Error("No response body");

					const decoder = new TextDecoder();
					let fullText = "";

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						const chunk = decoder.decode(value, { stream: true });
						fullText += chunk;

						// Update result with streamed content
						// Parse the stream to extract text content
						const textMatches = fullText.match(/0:"([^"]*)"/g);
						if (textMatches) {
							const combinedText = textMatches
								.map((m) => m.slice(3, -1))
								.join("")
								// Unescape common escape sequences
								.replace(/\\n/g, "\n")
								.replace(/\\t/g, "\t")
								.replace(/\\"/g, '"');

							const assistantMessage: ChatMessage = {
								id: generateUUID(),
								role: "assistant",
								parts: [{ type: "text" as const, text: combinedText }],
							};

							updateResult(model.id, {
								messages: [
									{
										id: messageId,
										role: "user",
										parts: [{ type: "text" as const, text: newPrompt }],
									},
									assistantMessage,
								],
							});
						}
					}

					const endTime = Date.now();
					updateResult(model.id, {
						status: "complete",
						endTime,
					});

					// Calculate duration after completion
					setResults((prev) =>
						prev.map((r) =>
							r.modelId === model.id
								? { ...r, duration: endTime - (r.startTime || endTime) }
								: r,
						),
					);
				} catch (error) {
					const err = error instanceof Error ? error : new Error(String(error));
					updateResult(model.id, {
						status: "error",
						error: err,
						endTime: Date.now(),
					});
				}
			});

			// Wait for all to complete
			await Promise.allSettled(completionPromises);
			setIsComparing(false);

			// Call onComplete callback
			if (onComplete) {
				setResults((currentResults) => {
					onComplete(currentResults);
					return currentResults;
				});
			}
		},
		[models, updateResult, onComplete],
	);

	// Stop all comparisons
	const stopComparison = useCallback(() => {
		setIsComparing(false);
		setResults((prev) =>
			prev.map((r) =>
				r.status === "streaming"
					? { ...r, status: "complete", endTime: Date.now() }
					: r,
			),
		);
	}, []);

	// Reset state
	const reset = useCallback(() => {
		setPrompt("");
		setIsComparing(false);
		setResults(initializeResults());
	}, [initializeResults]);

	return {
		isComparing,
		results,
		prompt,
		startComparison,
		stopComparison,
		reset,
	};
}
