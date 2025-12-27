/**
 * Custom Tools API Routes
 *
 * CRUD operations for user-defined custom tools
 */

import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../types";
import { createDb } from "../../lib/db";
import { customTool } from "../../lib/db/schema";

const customToolsRouter = new Hono<HonoEnv>();

// Schema validation
const customToolSchema = z.object({
	name: z
		.string()
		.min(1)
		.max(50)
		.regex(/^[a-z][a-z0-9_]*$/, "Must be snake_case starting with a letter"),
	description: z.string().min(1).max(500),
	inputSchema: z.object({
		type: z.literal("object"),
		properties: z.record(
			z.object({
				type: z.enum(["string", "number", "boolean"]),
				description: z.string().optional(),
			}),
		),
		required: z.array(z.string()).optional(),
	}),
	actionType: z.enum(["http_fetch", "code_execution", "mcp_call"]),
	actionConfig: z.union([
		// HTTP Fetch
		z.object({
			url: z.string().url(),
			method: z.enum(["GET", "POST", "PUT", "DELETE"]),
			headers: z.record(z.string()).optional(),
			bodyTemplate: z.string().optional(),
		}),
		// Code Execution
		z.object({
			code: z.string().min(1),
			language: z.enum(["javascript", "python"]),
		}),
		// MCP Call
		z.object({
			serverUrl: z.string().url(),
			toolName: z.string().min(1),
		}),
	]),
	needsApproval: z.boolean().optional().default(false),
});

// GET /api/tools/custom - List all custom tools for user
customToolsRouter.get("/", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		const db = createDb(c.env.DB);
		const tools = await db
			.select()
			.from(customTool)
			.where(eq(customTool.userId, user.id));

		// Transform to frontend format
		const formattedTools = tools.map((tool) => ({
			id: tool.id,
			name: tool.name,
			description: tool.description,
			parameters: extractParameters(tool.inputSchema as Record<string, unknown>),
			actionType: tool.actionType,
			actionConfig: tool.actionConfig,
			needsApproval: tool.needsApproval,
			isEnabled: tool.isEnabled,
			createdAt: tool.createdAt,
			updatedAt: tool.updatedAt,
		}));

		return c.json({ tools: formattedTools });
	} catch (error) {
		console.error("Failed to list custom tools:", error);
		return c.json({ error: "Failed to list tools" }, 500);
	}
});

// POST /api/tools/custom - Create a new custom tool
customToolsRouter.post("/", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		const body = await c.req.json();
		const validated = customToolSchema.parse(body);

		const db = createDb(c.env.DB);

		// Check for duplicate name
		const existing = await db
			.select()
			.from(customTool)
			.where(eq(customTool.name, validated.name))
			.limit(1);

		if (existing.length > 0 && existing[0].userId === user.id) {
			return c.json({ error: "Tool with this name already exists" }, 400);
		}

		const newTool = await db
			.insert(customTool)
			.values({
				name: validated.name,
				description: validated.description,
				inputSchema: validated.inputSchema,
				actionType: validated.actionType,
				actionConfig: validated.actionConfig,
				needsApproval: validated.needsApproval,
				userId: user.id,
			})
			.returning();

		return c.json({ tool: newTool[0] }, 201);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: "Validation failed", details: error.errors }, 400);
		}
		console.error("Failed to create custom tool:", error);
		return c.json({ error: "Failed to create tool" }, 500);
	}
});

// GET /api/tools/custom/:id - Get a specific custom tool
customToolsRouter.get("/:id", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const toolId = c.req.param("id");

	try {
		const db = createDb(c.env.DB);
		const tools = await db
			.select()
			.from(customTool)
			.where(eq(customTool.id, toolId))
			.limit(1);

		if (tools.length === 0) {
			return c.json({ error: "Tool not found" }, 404);
		}

		const tool = tools[0];
		if (tool.userId !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		return c.json({ tool });
	} catch (error) {
		console.error("Failed to get custom tool:", error);
		return c.json({ error: "Failed to get tool" }, 500);
	}
});

// PUT /api/tools/custom/:id - Update a custom tool
customToolsRouter.put("/:id", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const toolId = c.req.param("id");

	try {
		const body = await c.req.json();
		const validated = customToolSchema.parse(body);

		const db = createDb(c.env.DB);

		// Check ownership
		const existing = await db
			.select()
			.from(customTool)
			.where(eq(customTool.id, toolId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: "Tool not found" }, 404);
		}

		if (existing[0].userId !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		const updated = await db
			.update(customTool)
			.set({
				name: validated.name,
				description: validated.description,
				inputSchema: validated.inputSchema,
				actionType: validated.actionType,
				actionConfig: validated.actionConfig,
				needsApproval: validated.needsApproval,
				updatedAt: new Date(),
			})
			.where(eq(customTool.id, toolId))
			.returning();

		return c.json({ tool: updated[0] });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: "Validation failed", details: error.errors }, 400);
		}
		console.error("Failed to update custom tool:", error);
		return c.json({ error: "Failed to update tool" }, 500);
	}
});

// DELETE /api/tools/custom/:id - Delete a custom tool
customToolsRouter.delete("/:id", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const toolId = c.req.param("id");

	try {
		const db = createDb(c.env.DB);

		// Check ownership
		const existing = await db
			.select()
			.from(customTool)
			.where(eq(customTool.id, toolId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: "Tool not found" }, 404);
		}

		if (existing[0].userId !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		await db.delete(customTool).where(eq(customTool.id, toolId));

		return c.json({ success: true });
	} catch (error) {
		console.error("Failed to delete custom tool:", error);
		return c.json({ error: "Failed to delete tool" }, 500);
	}
});

// PATCH /api/tools/custom/:id/toggle - Toggle enabled state
customToolsRouter.patch("/:id/toggle", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const toolId = c.req.param("id");

	try {
		const db = createDb(c.env.DB);

		// Check ownership
		const existing = await db
			.select()
			.from(customTool)
			.where(eq(customTool.id, toolId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: "Tool not found" }, 404);
		}

		if (existing[0].userId !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		const updated = await db
			.update(customTool)
			.set({
				isEnabled: !existing[0].isEnabled,
				updatedAt: new Date(),
			})
			.where(eq(customTool.id, toolId))
			.returning();

		return c.json({ tool: updated[0] });
	} catch (error) {
		console.error("Failed to toggle custom tool:", error);
		return c.json({ error: "Failed to toggle tool" }, 500);
	}
});

// Helper to extract parameters from input schema for frontend
function extractParameters(
	schema: Record<string, unknown>,
): Array<{
	name: string;
	type: string;
	description: string;
	required: boolean;
}> {
	const properties = (schema.properties || {}) as Record<
		string,
		{ type: string; description?: string }
	>;
	const required = (schema.required || []) as string[];

	return Object.entries(properties).map(([name, prop]) => ({
		name,
		type: prop.type,
		description: prop.description || "",
		required: required.includes(name),
	}));
}

export { customToolsRouter };
