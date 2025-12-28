/**
 * Custom Tool Executor
 *
 * Converts stored custom tool definitions into executable AI SDK tools.
 *
 * Security Notes:
 * - Only HTTP fetch and MCP calls are supported server-side
 * - Code execution is NOT supported on the server for security reasons
 * - Users who want code execution should use the code artifact feature
 *   which runs safely in the browser via Pyodide
 */

import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../../lib/db";
import { type CustomTool, customTool } from "../../lib/db/schema";

type HttpFetchConfig = {
	url: string;
	method: "GET" | "POST" | "PUT" | "DELETE";
	headers?: Record<string, string>;
	bodyTemplate?: string;
};

type MCPCallConfig = {
	serverUrl: string;
	toolName: string;
};

type InputSchema = {
	type: "object";
	properties: Record<string, { type: string; description?: string }>;
	required?: string[];
};

/**
 * Interpolate template strings with parameter values
 * Example: "https://api.example.com/{{query}}" with {query: "test"} becomes "https://api.example.com/test"
 */
function interpolateTemplate(
	template: string,
	params: Record<string, unknown>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
		params[key] !== undefined ? String(params[key]) : `{{${key}}}`,
	);
}

/**
 * Convert stored input schema to Zod schema for validation
 */
function createZodSchema(inputSchema: InputSchema): z.ZodObject<z.ZodRawShape> {
	const shape: z.ZodRawShape = {};

	for (const [key, prop] of Object.entries(inputSchema.properties)) {
		let fieldSchema: z.ZodTypeAny;

		switch (prop.type) {
			case "number":
				fieldSchema = z.number();
				break;
			case "boolean":
				fieldSchema = z.boolean();
				break;
			default:
				fieldSchema = z.string();
		}

		if (prop.description) {
			fieldSchema = fieldSchema.describe(prop.description);
		}

		// Check if field is required
		if (!inputSchema.required?.includes(key)) {
			fieldSchema = fieldSchema.optional();
		}

		shape[key] = fieldSchema;
	}

	return z.object(shape);
}

/**
 * Execute HTTP fetch action
 */
async function executeHttpFetch(
	config: HttpFetchConfig,
	params: Record<string, unknown>,
): Promise<unknown> {
	const url = interpolateTemplate(config.url, params);
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(config.headers || {}),
	};

	// Interpolate headers
	for (const [key, value] of Object.entries(headers)) {
		headers[key] = interpolateTemplate(value, params);
	}

	const options: RequestInit = {
		method: config.method,
		headers,
	};

	// Add body for POST/PUT requests
	if (
		(config.method === "POST" || config.method === "PUT") &&
		config.bodyTemplate
	) {
		const bodyString = interpolateTemplate(config.bodyTemplate, params);
		options.body = bodyString;
	}

	const response = await fetch(url, options);

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const contentType = response.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		return await response.json();
	}

	return await response.text();
}

/**
 * Execute MCP call
 */
async function executeMCPCall(
	config: MCPCallConfig,
	params: Record<string, unknown>,
): Promise<unknown> {
	const response = await fetch(
		`${config.serverUrl}/api/tools/${config.toolName}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(params),
		},
	);

	if (!response.ok) {
		throw new Error(
			`MCP call failed: ${response.status} ${response.statusText}`,
		);
	}

	return await response.json();
}

/**
 * Convert a stored custom tool definition into an executable AI SDK tool
 */
export function createExecutableTool(toolDef: CustomTool) {
	const inputSchema = toolDef.inputSchema as InputSchema;
	const zodSchema = createZodSchema(inputSchema);

	return tool({
		description: toolDef.description,
		inputSchema: zodSchema,
		needsApproval: toolDef.needsApproval,
		execute: async (params) => {
			try {
				switch (toolDef.actionType) {
					case "http_fetch": {
						const config = toolDef.actionConfig as HttpFetchConfig;
						return await executeHttpFetch(config, params);
					}

					case "code_execution": {
						// Code execution is not supported server-side for security
						// Return instructions for the AI to use the code artifact instead
						return {
							error: true,
							message:
								"Code execution tools run in the browser only. " +
								"Use the code artifact feature to execute code safely.",
							suggestion: "Create a code artifact with the code to execute.",
						};
					}

					case "mcp_call": {
						const config = toolDef.actionConfig as MCPCallConfig;
						return await executeMCPCall(config, params);
					}

					default:
						throw new Error(`Unknown action type: ${toolDef.actionType}`);
				}
			} catch (error) {
				return {
					error: true,
					message: error instanceof Error ? error.message : String(error),
				};
			}
		},
	});
}

/**
 * Get all enabled custom tools for a user as AI SDK tools
 */
export async function getCustomToolsForUser(
	db: D1Database,
	userId: string,
): Promise<Record<string, ReturnType<typeof tool>>> {
	const drizzleDb = createDb(db);

	const userTools = await drizzleDb
		.select()
		.from(customTool)
		.where(eq(customTool.userId, userId));

	// Filter to only enabled tools (excluding code_execution for security)
	const enabledTools = userTools.filter(
		(t) => t.isEnabled && t.actionType !== "code_execution",
	);

	const tools: Record<string, ReturnType<typeof tool>> = {};
	for (const toolDef of enabledTools) {
		// Prefix custom tools with "custom_" to avoid conflicts
		tools[`custom_${toolDef.name}`] = createExecutableTool(toolDef);
	}

	return tools;
}
