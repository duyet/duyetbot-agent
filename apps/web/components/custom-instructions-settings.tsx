"use client";

import { useState } from "react";
import {
	BrainIcon,
	Code2Icon,
	FileSearchIcon,
	GraduationCapIcon,
	InfoIcon,
	PenToolIcon,
	Settings2Icon,
	SparklesIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	DEFAULT_AI_SETTINGS,
	INSTRUCTION_TEMPLATES,
	type InstructionTemplate,
	useCustomInstructions,
} from "@/lib/custom-instructions";

/**
 * Custom Instructions Settings Dialog
 *
 * Provides UI for:
 * - Enabling/disabling custom instructions
 * - Editing global instructions
 * - Selecting instruction templates
 * - Configuring AI generation settings
 */
export function CustomInstructionsSettings({ chatId }: { chatId?: string }) {
	const {
		instructions,
		aiSettings,
		updateGlobal,
		updateChat,
		setEnabled,
		setActiveTemplate,
		updateAISettings,
		resetSettings,
	} = useCustomInstructions();

	const [open, setOpen] = useState(false);
	const [globalInput, setGlobalInput] = useState(instructions.global);
	const [chatInput, setChatInput] = useState(
		chatId ? instructions.chatSpecific[chatId] || "" : "",
	);
	const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(
		instructions.activeTemplate,
	);

	const handleSave = () => {
		updateGlobal(globalInput);
		if (chatId) {
			updateChat(chatId, chatInput);
		}
		setActiveTemplate(selectedTemplate);
		setOpen(false);
	};

	const handleTemplateSelect = (template: InstructionTemplate) => {
		setSelectedTemplate(template.id);
		// Optionally append template to global instructions
		if (!globalInput.includes(template.instruction)) {
			setGlobalInput(
				globalInput
					? `${globalInput}\n\n${template.instruction}`
					: template.instruction,
			);
		}
	};

	const getCategoryIcon = (category: InstructionTemplate["category"]) => {
		const iconProps = { size: 16 };
		switch (category) {
			case "coding":
				return (
					<span className="flex h-4 w-4">
						<Code2Icon {...iconProps} />
					</span>
				);
			case "writing":
				return (
					<span className="flex h-4 w-4">
						<PenToolIcon {...iconProps} />
					</span>
				);
			case "analysis":
				return (
					<span className="flex h-4 w-4">
						<BrainIcon {...iconProps} />
					</span>
				);
			case "general":
				return (
					<span className="flex h-4 w-4">
						<GraduationCapIcon {...iconProps} />
					</span>
				);
			default:
				return (
					<span className="flex h-4 w-4">
						<SparklesIcon {...iconProps} />
					</span>
				);
		}
	};

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<Button className="gap-2" size="sm" variant="ghost">
					<span className="flex h-4 w-4">
						<SparklesIcon size={16} />
					</span>
					Custom Instructions
				</Button>
			</DialogTrigger>
			<DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span className="flex h-5 w-5">
							<SparklesIcon size={20} />
						</span>
						Custom Instructions & AI Settings
					</DialogTitle>
					<DialogDescription>
						Customize how the AI responds by setting instructions and generation
						parameters.
					</DialogDescription>
				</DialogHeader>

				<Tabs className="flex-1 overflow-hidden" defaultValue="instructions">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="instructions">Instructions</TabsTrigger>
						<TabsTrigger value="settings">AI Settings</TabsTrigger>
					</TabsList>

					<TabsContent
						className="flex flex-1 flex-col overflow-hidden"
						value="instructions"
					>
						<ScrollArea className="flex-1 px-1">
							<div className="space-y-6 pr-4">
								{/* Enable Toggle */}
								<div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
									<div className="space-y-0.5">
										<Label className="text-base" htmlFor="enable-instructions">
											Enable Custom Instructions
										</Label>
										<p className="text-muted-foreground text-sm">
											Apply your instructions to all conversations
										</p>
									</div>
									<Switch
										checked={instructions.enabled}
										id="enable-instructions"
										onCheckedChange={setEnabled}
									/>
								</div>

								{/* Global Instructions */}
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label className="text-base" htmlFor="global-instructions">
											Global Instructions
										</Label>
										<Badge className="text-xs" variant="outline">
											Applied to all chats
										</Badge>
									</div>
									<Textarea
										className="font-mono text-sm"
										id="global-instructions"
										onChange={(e) => setGlobalInput(e.target.value)}
										placeholder="Enter instructions that apply to all conversations...&#10;&#10;Example:&#10;- Always provide code examples&#10;- Explain technical concepts simply&#10;- Include error handling in code"
										rows={8}
										value={globalInput}
									/>
									<p className="text-muted-foreground text-xs">
										These instructions will be included in the system prompt for
										every chat.
									</p>
								</div>

								{/* Chat-Specific Instructions */}
								{chatId && (
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label className="text-base" htmlFor="chat-instructions">
												Chat-Specific Instructions
											</Label>
											<Badge className="text-xs" variant="outline">
												This chat only
											</Badge>
										</div>
										<Textarea
											className="font-mono text-sm"
											id="chat-instructions"
											onChange={(e) => setChatInput(e.target.value)}
											placeholder="Enter instructions specific to this conversation..."
											rows={4}
											value={chatInput}
										/>
									</div>
								)}

								{/* Template Library */}
								<div className="space-y-3">
									<Label className="flex items-center gap-2 text-base">
										<span className="flex h-4 w-4">
											<FileSearchIcon size={16} />
										</span>
										Instruction Templates
									</Label>
									<p className="text-muted-foreground text-sm">
										Quick-start with pre-built instruction sets
									</p>
									<div className="grid gap-3">
										{INSTRUCTION_TEMPLATES.map((template) => (
											<div
												className={`cursor-pointer rounded-lg border p-4 transition-all hover:bg-accent ${
													selectedTemplate === template.id
														? "border-primary bg-primary/5"
														: ""
												}`}
												key={template.id}
												onClick={() => handleTemplateSelect(template)}
											>
												<div className="flex items-start gap-3">
													<div className="mt-0.5 text-primary">
														{getCategoryIcon(template.category)}
													</div>
													<div className="flex-1 space-y-1">
														<div className="flex items-center justify-between">
															<h4 className="font-medium">{template.name}</h4>
															<Badge className="text-xs" variant="secondary">
																{template.category}
															</Badge>
														</div>
														<p className="text-muted-foreground text-sm">
															{template.description}
														</p>
													</div>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</ScrollArea>
					</TabsContent>

					<TabsContent
						className="flex flex-1 flex-col overflow-hidden"
						value="settings"
					>
						<ScrollArea className="flex-1 px-1">
							<div className="space-y-6 pr-4">
								<div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
									<span className="mt-0.5 flex h-5 w-5 text-muted-foreground">
										<InfoIcon size={20} />
									</span>
									<div className="space-y-1">
										<p className="font-medium text-sm">About AI Settings</p>
										<p className="text-muted-foreground text-xs">
											These parameters control how the AI generates responses.
											Changes apply to all new messages.
										</p>
									</div>
								</div>

								{/* Temperature */}
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<Label className="text-base" htmlFor="temperature">
											Temperature
										</Label>
										<Badge className="font-mono text-xs" variant="outline">
											{aiSettings.temperature.toFixed(1)}
										</Badge>
									</div>
									<Slider
										className="py-4"
										id="temperature"
										max={2}
										min={0}
										onValueChange={([value]) =>
											updateAISettings({ temperature: value })
										}
										step={0.1}
										value={[aiSettings.temperature]}
									/>
									<div className="flex justify-between text-muted-foreground text-xs">
										<span>Precise (0.0)</span>
										<span>Balanced (1.0)</span>
										<span>Creative (2.0)</span>
									</div>
									<p className="text-muted-foreground text-xs">
										Lower values produce more focused responses, higher values
										produce more varied and creative outputs.
									</p>
								</div>

								{/* Max Tokens */}
								<div className="space-y-2">
									<Label className="text-base" htmlFor="maxTokens">
										Maximum Response Length
									</Label>
									<div className="flex items-center gap-4">
										<Slider
											className="flex-1"
											id="maxTokens"
											max={8192}
											min={256}
											onValueChange={([value]) =>
												updateAISettings({ maxTokens: value })
											}
											step={256}
											value={[aiSettings.maxTokens || 4096]}
										/>
										<span className="min-w-[80px] text-right font-mono text-sm">
											{aiSettings.maxTokens || 4096}
										</span>
									</div>
									<p className="text-muted-foreground text-xs">
										Maximum number of tokens in the AI response. Leave empty for
										model default.
									</p>
								</div>

								{/* Top P */}
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<Label className="text-base" htmlFor="topP">
											Top P (Nucleus Sampling)
										</Label>
										<Badge className="font-mono text-xs" variant="outline">
											{aiSettings.topP?.toFixed(2) || "default"}
										</Badge>
									</div>
									<Slider
										className="py-4"
										id="topP"
										max={1}
										min={0}
										onValueChange={([value]) =>
											updateAISettings({ topP: value })
										}
										step={0.05}
										value={[aiSettings.topP || 1]}
									/>
									<p className="text-muted-foreground text-xs">
										Controls diversity by limiting to the most likely tokens
										that sum to probability P.
									</p>
								</div>

								{/* Frequency Penalty */}
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<Label className="text-base" htmlFor="frequencyPenalty">
											Frequency Penalty
										</Label>
										<Badge className="font-mono text-xs" variant="outline">
											{aiSettings.frequencyPenalty?.toFixed(1) || "0.0"}
										</Badge>
									</div>
									<Slider
										className="py-4"
										id="frequencyPenalty"
										max={2}
										min={-2}
										onValueChange={([value]) =>
											updateAISettings({ frequencyPenalty: value })
										}
										step={0.1}
										value={[aiSettings.frequencyPenalty || 0]}
									/>
									<p className="text-muted-foreground text-xs">
										Reduces repetition of frequently used tokens. Positive
										values decrease repetition.
									</p>
								</div>

								{/* Presence Penalty */}
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<Label className="text-base" htmlFor="presencePenalty">
											Presence Penalty
										</Label>
										<Badge className="font-mono text-xs" variant="outline">
											{aiSettings.presencePenalty?.toFixed(1) || "0.0"}
										</Badge>
									</div>
									<Slider
										className="py-4"
										id="presencePenalty"
										max={2}
										min={-2}
										onValueChange={([value]) =>
											updateAISettings({ presencePenalty: value })
										}
										step={0.1}
										value={[aiSettings.presencePenalty || 0]}
									/>
									<p className="text-muted-foreground text-xs">
										Encourages talking about new topics. Positive values
										increase topic diversity.
									</p>
								</div>

								{/* Reset Button */}
								<div className="flex justify-end border-t pt-4">
									<Button
										onClick={() => resetSettings()}
										size="sm"
										variant="outline"
									>
										<span className="mr-2 flex h-4 w-4">
											<Settings2Icon size={16} />
										</span>
										Reset to Defaults
									</Button>
								</div>
							</div>
						</ScrollArea>
					</TabsContent>
				</Tabs>

				<DialogFooter className="border-t pt-4">
					<Button onClick={() => setOpen(false)} variant="outline">
						Cancel
					</Button>
					<Button onClick={handleSave}>Save Changes</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
