"use client";

/**
 * Model Comparison Mode Component
 *
 * Allows users to compare responses from multiple AI models side-by-side.
 * Features:
 * - Model selection (2-4 models)
 * - Split view with resizable panels
 * - Response time comparison
 * - Tabs view on mobile
 */

import { Scale, Sparkles, Timer, X } from "lucide-react";
import { useCallback, useState } from "react";
import { chatModels, type ChatModel } from "@/lib/ai/models";
import type { ComparisonResult } from "@/hooks/use-comparison-chat";
import { useComparisonChat } from "@/hooks/use-comparison-chat";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

interface ModelComparisonProps {
	onClose: () => void;
}

function ModelSelector({
	selectedModels,
	onToggle,
	maxModels = 4,
}: {
	selectedModels: string[];
	onToggle: (modelId: string) => void;
	maxModels?: number;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<span className="font-medium text-sm">
					Select models to compare ({selectedModels.length}/{maxModels})
				</span>
			</div>
			<div className="flex flex-wrap gap-2">
				{chatModels.map((model) => {
					const isSelected = selectedModels.includes(model.id);
					const isDisabled =
						!isSelected && selectedModels.length >= maxModels;

					return (
						<TooltipProvider key={model.id}>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										className={cn(
											"rounded-lg border px-3 py-1.5 text-sm transition-colors",
											isSelected
												? "border-primary bg-primary text-primary-foreground"
												: "border-border bg-background hover:bg-accent",
											isDisabled && "cursor-not-allowed opacity-50",
										)}
										disabled={isDisabled}
										onClick={() => onToggle(model.id)}
										type="button"
									>
										{model.name}
									</button>
								</TooltipTrigger>
								<TooltipContent>
									<p>{model.description}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					);
				})}
			</div>
		</div>
	);
}

function ComparisonPanel({
	result,
	isStreaming,
}: {
	result: ComparisonResult;
	isStreaming: boolean;
}) {
	const assistantMessage = result.messages.find((m) => m.role === "assistant");
	const textPart = assistantMessage?.parts?.find((p) => p.type === "text");
	const content = textPart?.text || "";

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b p-3">
				<div className="flex items-center gap-2">
					<span className="font-semibold text-sm">{result.modelName}</span>
					{result.status === "streaming" && (
						<span className="flex items-center gap-1 text-muted-foreground text-xs">
							<Sparkles className="h-3 w-3 animate-pulse" />
							Streaming...
						</span>
					)}
					{result.status === "error" && (
						<span className="text-destructive text-xs">Error</span>
					)}
				</div>
				{result.duration && (
					<div className="flex items-center gap-1 text-muted-foreground text-xs">
						<Timer className="h-3 w-3" />
						{(result.duration / 1000).toFixed(2)}s
					</div>
				)}
			</div>

			{/* Content */}
			<ScrollArea className="flex-1 p-4">
				{result.status === "idle" && (
					<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
						Waiting for prompt...
					</div>
				)}
				{result.status === "error" && (
					<div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
						{result.error?.message || "An error occurred"}
					</div>
				)}
				{content && <Markdown>{content}</Markdown>}
				{result.status === "streaming" && !content && (
					<div className="flex items-center gap-2 text-muted-foreground">
						<div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
						<div
							className="h-2 w-2 animate-bounce rounded-full bg-primary"
							style={{ animationDelay: "0.1s" }}
						/>
						<div
							className="h-2 w-2 animate-bounce rounded-full bg-primary"
							style={{ animationDelay: "0.2s" }}
						/>
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

export function ModelComparison({ onClose }: ModelComparisonProps) {
	const [selectedModelIds, setSelectedModelIds] = useState<string[]>([
		"anthropic/claude-sonnet-4",
		"openai/gpt-4o",
	]);
	const [inputValue, setInputValue] = useState("");

	const selectedModels = selectedModelIds
		.map((id) => chatModels.find((m) => m.id === id))
		.filter((m): m is ChatModel => m !== undefined);

	const { isComparing, results, startComparison, reset } = useComparisonChat({
		models: selectedModels,
	});

	const handleToggleModel = useCallback((modelId: string) => {
		setSelectedModelIds((prev) =>
			prev.includes(modelId)
				? prev.filter((id) => id !== modelId)
				: [...prev, modelId],
		);
	}, []);

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (!inputValue.trim() || isComparing) return;

			startComparison(inputValue.trim());
			setInputValue("");
		},
		[inputValue, isComparing, startComparison],
	);

	const handleReset = useCallback(() => {
		reset();
		setInputValue("");
	}, [reset]);

	return (
		<div className="flex h-full flex-col bg-background">
			{/* Header */}
			<div className="flex items-center justify-between border-b p-4">
				<div className="flex items-center gap-2">
					<Scale className="h-5 w-5" />
					<h2 className="font-semibold">Model Comparison</h2>
				</div>
				<Button onClick={onClose} size="icon" variant="ghost">
					<X className="h-4 w-4" />
					<span className="sr-only">Close</span>
				</Button>
			</div>

			{/* Model Selection */}
			<div className="border-b p-4">
				<ModelSelector
					maxModels={4}
					onToggle={handleToggleModel}
					selectedModels={selectedModelIds}
				/>
			</div>

			{/* Input */}
			<form className="border-b p-4" onSubmit={handleSubmit}>
				<div className="flex gap-2">
					<Textarea
						className="min-h-[60px] flex-1 resize-none"
						disabled={isComparing || selectedModelIds.length < 2}
						onChange={(e) => setInputValue(e.target.value)}
						placeholder={
							selectedModelIds.length < 2
								? "Select at least 2 models to compare..."
								: "Enter a prompt to compare model responses..."
						}
						rows={2}
						value={inputValue}
					/>
					<div className="flex flex-col gap-2">
						<Button
							disabled={
								isComparing ||
								!inputValue.trim() ||
								selectedModelIds.length < 2
							}
							type="submit"
						>
							{isComparing ? "Comparing..." : "Compare"}
						</Button>
						{results.length > 0 && (
							<Button onClick={handleReset} type="button" variant="outline">
								Reset
							</Button>
						)}
					</div>
				</div>
			</form>

			{/* Results */}
			<div className="flex-1 overflow-hidden">
				{results.length === 0 ? (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<div className="text-center">
							<Scale className="mx-auto mb-4 h-12 w-12 opacity-50" />
							<p className="text-lg">Compare AI model responses</p>
							<p className="text-sm">
								Select models and enter a prompt to see how different models
								respond
							</p>
						</div>
					</div>
				) : (
					<>
						{/* Desktop: Grid view */}
						<div className="hidden h-full md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{results.map((result) => (
								<div className="border-r last:border-r-0" key={result.modelId}>
									<ComparisonPanel
										isStreaming={result.status === "streaming"}
										result={result}
									/>
								</div>
							))}
						</div>

						{/* Mobile: Tabs view */}
						<div className="h-full md:hidden">
							<Tabs
								className="flex h-full flex-col"
								defaultValue={results[0]?.modelId}
							>
								<TabsList className="w-full justify-start rounded-none border-b">
									{results.map((result) => (
										<TabsTrigger
											className="flex-1"
											key={result.modelId}
											value={result.modelId}
										>
											{result.modelName.split(" ")[0]}
											{result.status === "streaming" && (
												<Sparkles className="ml-1 h-3 w-3 animate-pulse" />
											)}
										</TabsTrigger>
									))}
								</TabsList>
								{results.map((result) => (
									<TabsContent
										className="mt-0 flex-1"
										key={result.modelId}
										value={result.modelId}
									>
										<ComparisonPanel
											isStreaming={result.status === "streaming"}
											result={result}
										/>
									</TabsContent>
								))}
							</Tabs>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
