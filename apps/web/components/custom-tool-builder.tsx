"use client";

import { Code, Globe, Loader2, Plus, Server, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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

type ActionType = "http_fetch" | "code_execution" | "mcp_call";

type HttpFetchConfig = {
	url: string;
	method: "GET" | "POST" | "PUT" | "DELETE";
	headers?: Record<string, string>;
	bodyTemplate?: string;
};

type CodeExecutionConfig = {
	code: string;
	language: "javascript" | "python";
};

type MCPCallConfig = {
	serverUrl: string;
	toolName: string;
};

type ActionConfig = HttpFetchConfig | CodeExecutionConfig | MCPCallConfig;

type ParameterField = {
	name: string;
	type: "string" | "number" | "boolean";
	description: string;
	required: boolean;
};

type CustomToolDefinition = {
	id?: string;
	name: string;
	description: string;
	parameters: ParameterField[];
	actionType: ActionType;
	actionConfig: ActionConfig;
	needsApproval: boolean;
	isEnabled: boolean;
};

type CustomToolBuilderProps = {
	onToolCreated?: () => void;
	onToolUpdated?: () => void;
};

const DEFAULT_HTTP_CONFIG: HttpFetchConfig = {
	url: "https://api.example.com/{{param}}",
	method: "GET",
};

const DEFAULT_CODE_CONFIG: CodeExecutionConfig = {
	code: "// Return the result\nreturn { result: input.param };",
	language: "javascript",
};

const DEFAULT_MCP_CONFIG: MCPCallConfig = {
	serverUrl: "https://mcp.example.com",
	toolName: "my_tool",
};

function getDefaultConfig(actionType: ActionType): ActionConfig {
	switch (actionType) {
		case "http_fetch":
			return DEFAULT_HTTP_CONFIG;
		case "code_execution":
			return DEFAULT_CODE_CONFIG;
		case "mcp_call":
			return DEFAULT_MCP_CONFIG;
	}
}

export function CustomToolBuilder({
	onToolCreated,
	onToolUpdated,
}: CustomToolBuilderProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [tools, setTools] = useState<CustomToolDefinition[]>([]);
	const [editingTool, setEditingTool] = useState<CustomToolDefinition | null>(
		null,
	);

	// Form state
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [parameters, setParameters] = useState<ParameterField[]>([]);
	const [actionType, setActionType] = useState<ActionType>("http_fetch");
	const [actionConfig, setActionConfig] = useState<ActionConfig>(
		getDefaultConfig("http_fetch"),
	);
	const [needsApproval, setNeedsApproval] = useState(false);

	// Load existing tools
	const loadTools = useCallback(async () => {
		try {
			const response = await fetch("/api/tools/custom");
			if (response.ok) {
				const data = (await response.json()) as {
					tools?: CustomToolDefinition[];
				};
				setTools(data.tools || []);
			}
		} catch (error) {
			console.error("Failed to load custom tools:", error);
		}
	}, []);

	useEffect(() => {
		loadTools();
	}, [loadTools]);

	const resetForm = () => {
		setName("");
		setDescription("");
		setParameters([]);
		setActionType("http_fetch");
		setActionConfig(getDefaultConfig("http_fetch"));
		setNeedsApproval(false);
		setEditingTool(null);
	};

	const handleActionTypeChange = (type: ActionType) => {
		setActionType(type);
		setActionConfig(getDefaultConfig(type));
	};

	const addParameter = () => {
		setParameters([
			...parameters,
			{ name: "", type: "string", description: "", required: true },
		]);
	};

	const updateParameter = (
		index: number,
		field: keyof ParameterField,
		value: string | boolean,
	) => {
		const updated = [...parameters];
		updated[index] = { ...updated[index], [field]: value };
		setParameters(updated);
	};

	const removeParameter = (index: number) => {
		setParameters(parameters.filter((_, i) => i !== index));
	};

	const handleSubmit = async () => {
		if (!name.trim()) {
			toast.error("Tool name is required");
			return;
		}
		if (!description.trim()) {
			toast.error("Tool description is required");
			return;
		}

		setIsLoading(true);
		try {
			const toolData = {
				name: name.trim(),
				description: description.trim(),
				inputSchema: {
					type: "object",
					properties: Object.fromEntries(
						parameters.map((p) => [
							p.name,
							{ type: p.type, description: p.description },
						]),
					),
					required: parameters.filter((p) => p.required).map((p) => p.name),
				},
				actionType,
				actionConfig,
				needsApproval,
			};

			const url = editingTool?.id
				? `/api/tools/custom/${editingTool.id}`
				: "/api/tools/custom";

			const response = await fetch(url, {
				method: editingTool?.id ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(toolData),
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { message?: string };
				throw new Error(errorData.message || "Failed to save tool");
			}

			toast.success(
				editingTool ? "Tool updated successfully" : "Tool created successfully",
			);
			resetForm();
			setIsOpen(false);
			loadTools();

			if (editingTool) {
				onToolUpdated?.();
			} else {
				onToolCreated?.();
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to save tool",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async (toolId: string) => {
		if (!confirm("Are you sure you want to delete this tool?")) {
			return;
		}

		try {
			const response = await fetch(`/api/tools/custom/${toolId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete tool");
			}

			toast.success("Tool deleted");
			loadTools();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete tool",
			);
		}
	};

	const handleEdit = (tool: CustomToolDefinition) => {
		setEditingTool(tool);
		setName(tool.name);
		setDescription(tool.description);
		setParameters(tool.parameters || []);
		setActionType(tool.actionType);
		setActionConfig(tool.actionConfig);
		setNeedsApproval(tool.needsApproval);
		setIsOpen(true);
	};

	const getActionIcon = (type: ActionType) => {
		switch (type) {
			case "http_fetch":
				return <Globe className="h-4 w-4" />;
			case "code_execution":
				return <Code className="h-4 w-4" />;
			case "mcp_call":
				return <Server className="h-4 w-4" />;
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-medium text-lg">Custom Tools</h3>
					<p className="text-muted-foreground text-sm">
						Create custom tools to extend AI capabilities
					</p>
				</div>
				<Dialog
					open={isOpen}
					onOpenChange={(open) => {
						setIsOpen(open);
						if (!open) resetForm();
					}}
				>
					<DialogTrigger asChild>
						<Button size="sm">
							<Plus className="mr-2 h-4 w-4" />
							Create Tool
						</Button>
					</DialogTrigger>
					<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
						<DialogHeader>
							<DialogTitle>
								{editingTool ? "Edit Tool" : "Create Custom Tool"}
							</DialogTitle>
							<DialogDescription>
								Define a custom tool with parameters and an action to execute
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-4">
							{/* Basic Info */}
							<div className="space-y-2">
								<Label htmlFor="name">Tool Name</Label>
								<Input
									id="name"
									placeholder="my_custom_tool"
									value={name}
									onChange={(e) => setName(e.target.value.replace(/\s/g, "_"))}
								/>
								<p className="text-muted-foreground text-xs">
									Use snake_case for tool names
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									placeholder="Describe what this tool does and when to use it..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={3}
								/>
							</div>

							{/* Parameters */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label>Parameters</Label>
									<Button size="sm" variant="outline" onClick={addParameter}>
										<Plus className="mr-1 h-3 w-3" />
										Add
									</Button>
								</div>
								{parameters.map((param, index) => (
									<div
										key={`param-${param.name || index}`}
										className="flex items-start gap-2 rounded-md border p-2"
									>
										<div className="flex-1 space-y-2">
											<Input
												placeholder="Parameter name"
												value={param.name}
												onChange={(e) =>
													updateParameter(
														index,
														"name",
														e.target.value.replace(/\s/g, "_"),
													)
												}
											/>
											<Input
												placeholder="Description"
												value={param.description}
												onChange={(e) =>
													updateParameter(index, "description", e.target.value)
												}
											/>
											<div className="flex items-center gap-2">
												<Select
													value={param.type}
													onValueChange={(v) =>
														updateParameter(
															index,
															"type",
															v as "string" | "number" | "boolean",
														)
													}
												>
													<SelectTrigger className="w-24">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="string">String</SelectItem>
														<SelectItem value="number">Number</SelectItem>
														<SelectItem value="boolean">Boolean</SelectItem>
													</SelectContent>
												</Select>
												<label className="flex items-center gap-1 text-sm">
													<Switch
														checked={param.required}
														onCheckedChange={(v) =>
															updateParameter(index, "required", v)
														}
													/>
													Required
												</label>
											</div>
										</div>
										<Button
											size="icon"
											variant="ghost"
											onClick={() => removeParameter(index)}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								))}
							</div>

							{/* Action Type */}
							<div className="space-y-2">
								<Label>Action Type</Label>
								<Select
									value={actionType}
									onValueChange={(v) => handleActionTypeChange(v as ActionType)}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="http_fetch">
											<div className="flex items-center gap-2">
												<Globe className="h-4 w-4" />
												HTTP Fetch
											</div>
										</SelectItem>
										<SelectItem value="code_execution">
											<div className="flex items-center gap-2">
												<Code className="h-4 w-4" />
												Code Execution
											</div>
										</SelectItem>
										<SelectItem value="mcp_call">
											<div className="flex items-center gap-2">
												<Server className="h-4 w-4" />
												MCP Call
											</div>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Action Config */}
							{actionType === "http_fetch" && (
								<div className="space-y-2">
									<Label>HTTP Configuration</Label>
									<div className="space-y-2 rounded-md border p-3">
										<div className="flex gap-2">
											<Select
												value={(actionConfig as HttpFetchConfig).method}
												onValueChange={(v) =>
													setActionConfig({
														...actionConfig,
														method: v as "GET" | "POST" | "PUT" | "DELETE",
													} as HttpFetchConfig)
												}
											>
												<SelectTrigger className="w-24">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="GET">GET</SelectItem>
													<SelectItem value="POST">POST</SelectItem>
													<SelectItem value="PUT">PUT</SelectItem>
													<SelectItem value="DELETE">DELETE</SelectItem>
												</SelectContent>
											</Select>
											<Input
												placeholder="https://api.example.com/{{param}}"
												value={(actionConfig as HttpFetchConfig).url}
												onChange={(e) =>
													setActionConfig({
														...actionConfig,
														url: e.target.value,
													} as HttpFetchConfig)
												}
											/>
										</div>
										<p className="text-muted-foreground text-xs">
											Use {"{{paramName}}"} to insert parameter values
										</p>
										{((actionConfig as HttpFetchConfig).method === "POST" ||
											(actionConfig as HttpFetchConfig).method === "PUT") && (
											<Textarea
												placeholder='{"key": "{{value}}"}'
												value={(actionConfig as HttpFetchConfig).bodyTemplate}
												onChange={(e) =>
													setActionConfig({
														...actionConfig,
														bodyTemplate: e.target.value,
													} as HttpFetchConfig)
												}
												rows={3}
											/>
										)}
									</div>
								</div>
							)}

							{actionType === "code_execution" && (
								<div className="space-y-2">
									<Label>Code</Label>
									<div className="space-y-2 rounded-md border p-3">
										<Select
											value={(actionConfig as CodeExecutionConfig).language}
											onValueChange={(v) =>
												setActionConfig({
													...actionConfig,
													language: v as "javascript" | "python",
												} as CodeExecutionConfig)
											}
										>
											<SelectTrigger className="w-32">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="javascript">JavaScript</SelectItem>
												<SelectItem value="python">Python</SelectItem>
											</SelectContent>
										</Select>
										<Textarea
											className="font-mono text-sm"
											placeholder="// Access parameters via 'input' object"
											value={(actionConfig as CodeExecutionConfig).code}
											onChange={(e) =>
												setActionConfig({
													...actionConfig,
													code: e.target.value,
												} as CodeExecutionConfig)
											}
											rows={6}
										/>
										<p className="text-muted-foreground text-xs">
											Access parameters via the &apos;input&apos; object (e.g.,
											input.query)
										</p>
									</div>
								</div>
							)}

							{actionType === "mcp_call" && (
								<div className="space-y-2">
									<Label>MCP Configuration</Label>
									<div className="space-y-2 rounded-md border p-3">
										<Input
											placeholder="MCP Server URL"
											value={(actionConfig as MCPCallConfig).serverUrl}
											onChange={(e) =>
												setActionConfig({
													...actionConfig,
													serverUrl: e.target.value,
												} as MCPCallConfig)
											}
										/>
										<Input
											placeholder="Tool Name"
											value={(actionConfig as MCPCallConfig).toolName}
											onChange={(e) =>
												setActionConfig({
													...actionConfig,
													toolName: e.target.value,
												} as MCPCallConfig)
											}
										/>
									</div>
								</div>
							)}

							{/* Settings */}
							<div className="flex items-center justify-between rounded-md border p-3">
								<div>
									<Label>Require Approval</Label>
									<p className="text-muted-foreground text-sm">
										Ask for user confirmation before executing
									</p>
								</div>
								<Switch
									checked={needsApproval}
									onCheckedChange={setNeedsApproval}
								/>
							</div>
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => setIsOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleSubmit} disabled={isLoading}>
								{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								{editingTool ? "Update Tool" : "Create Tool"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* Tool List */}
			<div className="space-y-2">
				{tools.length === 0 ? (
					<p className="py-4 text-center text-muted-foreground text-sm">
						No custom tools created yet
					</p>
				) : (
					tools.map((tool) => (
						<div
							key={tool.id}
							className="flex items-center justify-between rounded-md border p-3"
						>
							<div className="flex items-center gap-3">
								{getActionIcon(tool.actionType)}
								<div>
									<p className="font-medium">{tool.name}</p>
									<p className="line-clamp-1 text-muted-foreground text-sm">
										{tool.description}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => handleEdit(tool)}
								>
									Edit
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => tool.id && handleDelete(tool.id)}
								>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
