"use client";

import { Bot, Loader2, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Agent, AgentCategory, AgentTemplate } from "@/lib/api-client";
import {
	createAgent,
	getAgentTemplates,
	updateAgent,
	deleteAgent,
	toggleAgent,
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Available models (same as in API)
const AVAILABLE_MODELS = [
	{ id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
	{ id: "anthropic/claude-opus-4-20250514", name: "Claude Opus 4" },
	{ id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
	{ id: "openai/gpt-4o", name: "GPT-4o" },
	{ id: "openai/o1", name: "o1" },
	{ id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
	{ id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
	{ id: "xai/grok-2-1212", name: "Grok 2" },
	{ id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
];

type AgentBuilderProps = {
	agent?: Agent;
	onAgentCreated?: () => void;
	onAgentUpdated?: () => void;
	onAgentDeleted?: () => void;
};

const EMPTY_AGENT: Omit<Agent, "id" | "createdAt" | "updatedAt"> = {
	name: "",
	description: "",
	avatar: null,
	systemPrompt: "",
	guidelines: "",
	outputFormat: "",
	modelId: "anthropic/claude-sonnet-4-20250514",
	temperature: "0.7",
	maxTokens: "4096",
	topP: "1",
	frequencyPenalty: "0",
	presencePenalty: "0",
	enabledTools: [],
	needsApproval: false,
	isEnabled: true,
	category: "custom",
};

export function AgentBuilder({
	agent,
	onAgentCreated,
	onAgentUpdated,
	onAgentDeleted,
}: AgentBuilderProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [templates, setTemplates] = useState<{
		categories: AgentCategory[];
		models: string[];
		templates: Record<string, AgentTemplate>;
	} | null>(null);
	const [agentData, setAgentData] = useState<
		Omit<Agent, "id" | "createdAt" | "updatedAt">
	>(EMPTY_AGENT);

	const isEditMode = Boolean(agent?.id);

	// Load templates when dialog opens
	useEffect(() => {
		if (isOpen && !templates) {
			setIsLoading(true);
			getAgentTemplates()
				.then(setTemplates)
				.catch((err) => {
					console.error("Failed to load templates:", err);
					toast.error("Failed to load agent templates");
				})
				.finally(() => setIsLoading(false));
		}
	}, [isOpen, templates]);

	// Reset form when opening/closing
	useEffect(() => {
		if (isOpen && agent) {
			setAgentData(agent);
		} else if (!isOpen) {
			setAgentData(EMPTY_AGENT);
		}
	}, [isOpen, agent]);

	// Apply template when category changes
	const handleCategoryChange = useCallback(
		(category: string) => {
			setAgentData((prev) => {
				const updated = { ...prev, category };
				if (templates?.templates[category]) {
					const template = templates.templates[category];
					return {
						...updated,
						systemPrompt: template.systemPrompt,
						guidelines: template.guidelines,
						outputFormat: template.outputFormat,
					};
				}
				return updated;
			});
		},
		[templates],
	);

	const handleSave = useCallback(async () => {
		setIsSaving(true);
		try {
			if (isEditMode && agent?.id) {
				const updated = await updateAgent(agent.id, agentData);
				if (updated) {
					toast.success("Agent updated successfully");
					onAgentUpdated?.();
					setIsOpen(false);
				} else {
					toast.error("Failed to update agent");
				}
			} else {
				const created = await createAgent(agentData);
				if (created) {
					toast.success("Agent created successfully");
					onAgentCreated?.();
					setIsOpen(false);
				} else {
					toast.error("Failed to create agent");
				}
			}
		} catch (error) {
			console.error("Failed to save agent:", error);
			toast.error("An error occurred while saving the agent");
		} finally {
			setIsSaving(false);
		}
	}, [agentData, isEditMode, agent?.id, onAgentCreated, onAgentUpdated]);

	const handleDelete = useCallback(async () => {
		if (!agent?.id) return;

		if (!confirm("Are you sure you want to delete this agent?")) return;

		setIsSaving(true);
		try {
			const success = await deleteAgent(agent.id);
			if (success) {
				toast.success("Agent deleted successfully");
				onAgentDeleted?.();
				setIsOpen(false);
			} else {
				toast.error("Failed to delete agent");
			}
		} catch (error) {
			console.error("Failed to delete agent:", error);
			toast.error("An error occurred while deleting the agent");
		} finally {
			setIsSaving(false);
		}
	}, [agent?.id, onAgentDeleted]);

	const handleToggle = useCallback(async () => {
		if (!agent?.id) return;

		try {
			const updated = await toggleAgent(agent.id);
			if (updated) {
				toast.success(`Agent ${updated.isEnabled ? "enabled" : "disabled"}`);
				onAgentUpdated?.();
			} else {
				toast.error("Failed to toggle agent");
			}
		} catch (error) {
			console.error("Failed to toggle agent:", error);
			toast.error("An error occurred while toggling the agent");
		}
	}, [agent?.id, onAgentUpdated]);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				{agent ? (
					<Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
						Edit
					</Button>
				) : (
					<Button variant="outline" size="sm">
						<Plus className="mr-2 h-4 w-4" />
						New Agent
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Bot className="h-5 w-5" />
						{isEditMode ? "Edit Agent" : "Create New Agent"}
					</DialogTitle>
					<DialogDescription>
						{isEditMode
							? "Modify your custom AI agent's personality and behavior"
							: "Define a custom AI agent with its own personality and behavior"}
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="space-y-6 py-4">
						{/* Basic Info */}
						<div className="space-y-4">
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr,auto]">
								<div className="space-y-2">
									<Label htmlFor="name">Name</Label>
									<Input
										id="name"
										placeholder="My Custom Agent"
										value={agentData.name}
										onChange={(e) =>
											setAgentData((prev) => ({ ...prev, name: e.target.value }))
										}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="avatar">Avatar</Label>
									<Input
										id="avatar"
										placeholder="🤖"
										maxLength={2}
										value={agentData.avatar || ""}
										onChange={(e) =>
											setAgentData((prev) => ({ ...prev, avatar: e.target.value }))
										}
										className="w-20 text-center"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									placeholder="A brief description of what this agent does"
									value={agentData.description}
									onChange={(e) =>
										setAgentData((prev) => ({ ...prev, description: e.target.value }))
									}
									rows={2}
								/>
							</div>
						</div>

						{/* Category Selection */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="category">Category</Label>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 text-xs"
									onClick={() => {
										if (templates?.templates[agentData.category]) {
											const template = templates.templates[agentData.category];
											setAgentData((prev) => ({
												...prev,
												systemPrompt: template.systemPrompt,
												guidelines: template.guidelines,
												outputFormat: template.outputFormat,
											}));
											toast.success("Template applied");
										}
									}}
								>
									<Wand2 className="mr-1 h-3 w-3" />
									Apply Template
								</Button>
							</div>
							<Select
								value={agentData.category}
								onValueChange={handleCategoryChange}
							>
								<SelectTrigger id="category">
									<SelectValue placeholder="Select a category" />
								</SelectTrigger>
								<SelectContent>
									{templates?.categories.map((cat) => (
										<SelectItem key={cat.value} value={cat.value}>
											<div>
												<div className="font-medium">{cat.label}</div>
												<div className="text-xs text-muted-foreground">
													{cat.description}
												</div>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* System Prompt */}
						<div className="space-y-2">
							<Label htmlFor="systemPrompt">System Prompt</Label>
							<Textarea
								id="systemPrompt"
								placeholder="You are an expert assistant with..."
								value={agentData.systemPrompt}
								onChange={(e) =>
									setAgentData((prev) => ({ ...prev, systemPrompt: e.target.value }))
								}
								rows={4}
								className="font-mono text-sm"
							/>
							<p className="text-xs text-muted-foreground">
								Defines the agent's identity and core behavior
							</p>
						</div>

						{/* Guidelines */}
						<div className="space-y-2">
							<Label htmlFor="guidelines">Guidelines</Label>
							<Textarea
								id="guidelines"
								placeholder="- Be concise and clear&#10;- Provide examples&#10;- Explain your reasoning"
								value={agentData.guidelines}
								onChange={(e) =>
									setAgentData((prev) => ({ ...prev, guidelines: e.target.value }))
								}
								rows={3}
								className="font-mono text-sm"
							/>
							<p className="text-xs text-muted-foreground">
								Specific guidelines for how the agent should respond (one per line)
							</p>
						</div>

						{/* Output Format */}
						<div className="space-y-2">
							<Label htmlFor="outputFormat">Output Format</Label>
							<Textarea
								id="outputFormat"
								placeholder="Use markdown with code blocks for code..."
								value={agentData.outputFormat}
								onChange={(e) =>
									setAgentData((prev) => ({ ...prev, outputFormat: e.target.value }))
								}
								rows={2}
								className="font-mono text-sm"
							/>
							<p className="text-xs text-muted-foreground">
								Preferred format for responses
							</p>
						</div>

						{/* Model Settings */}
						<div className="space-y-4">
							<Label>Model Settings</Label>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="modelId">Model</Label>
									<Select
										value={agentData.modelId}
										onValueChange={(value) =>
											setAgentData((prev) => ({ ...prev, modelId: value }))
										}
									>
										<SelectTrigger id="modelId">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{AVAILABLE_MODELS.map((model) => (
												<SelectItem key={model.id} value={model.id}>
													{model.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="temperature">
										Temperature: {agentData.temperature}
									</Label>
									<Input
										id="temperature"
										type="range"
										min="0"
										max="2"
										step="0.1"
										value={agentData.temperature}
										onChange={(e) =>
											setAgentData((prev) => ({ ...prev, temperature: e.target.value }))
										}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="maxTokens">Max Tokens</Label>
									<Input
										id="maxTokens"
										type="number"
										min="256"
										max="32000"
										step="256"
										value={agentData.maxTokens}
										onChange={(e) =>
											setAgentData((prev) => ({ ...prev, maxTokens: e.target.value }))
										}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="topP">Top P: {agentData.topP}</Label>
									<Input
										id="topP"
										type="range"
										min="0"
										max="1"
										step="0.05"
										value={agentData.topP}
										onChange={(e) =>
											setAgentData((prev) => ({ ...prev, topP: e.target.value }))
										}
									/>
								</div>
							</div>
						</div>

						{/* Settings */}
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label>Require Approval</Label>
								<p className="text-xs text-muted-foreground">
									Ask for confirmation before using this agent
								</p>
							</div>
							<Switch
								checked={agentData.needsApproval}
								onCheckedChange={(checked) =>
									setAgentData((prev) => ({ ...prev, needsApproval: checked }))
								}
							/>
						</div>
					</div>
				)}

				<DialogFooter className="gap-2">
					{isEditMode && (
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDelete}
							disabled={isSaving}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</Button>
					)}
					<div className="flex items-center gap-2 ml-auto">
						{isEditMode && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleToggle}
								disabled={isSaving}
							>
								{agent?.isEnabled ? "Disable" : "Enable"}
							</Button>
						)}
						<Button onClick={handleSave} disabled={isSaving || isLoading}>
							{isSaving ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Save className="mr-2 h-4 w-4" />
							)}
							{isEditMode ? "Save Changes" : "Create Agent"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
