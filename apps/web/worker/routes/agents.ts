/**
 * Agents API Routes
 *
 * CRUD operations for user-defined AI agents/personas
 */

import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../../lib/db";
import { agent } from "../../lib/db/schema";
import type { HonoEnv } from "../types";

const agentsRouter = new Hono<HonoEnv>();

// Available models from OpenRouter
const AVAILABLE_MODELS = [
	"anthropic/claude-sonnet-4-20250514",
	"anthropic/claude-opus-4-20250514",
	"anthropic/claude-3.5-sonnet",
	"openai/gpt-4o",
	"openai/o1",
	"google/gemini-2.5-flash",
	"google/gemini-2.5-pro",
	"xai/grok-2-1212",
	"deepseek/deepseek-chat",
] as const;

// Agent categories with templates
const AGENT_CATEGORIES = [
	{
		value: "custom",
		label: "Custom Agent",
		description: "Create your own agent from scratch",
	},
	{
		value: "coding",
		label: "Coding Assistant",
		description: "Help with programming and code review",
	},
	{
		value: "writing",
		label: "Writing Assistant",
		description: "Help with writing and editing",
	},
	{
		value: "analysis",
		label: "Data Analyst",
		description: "Analyze data and provide insights",
	},
	{
		value: "research",
		label: "Research Assistant",
		description: "Help with research and information gathering",
	},
	{
		value: "learning",
		label: "Learning Tutor",
		description: "Teach and explain concepts",
	},
] as const;

// Schema validation
const agentSchema = z.object({
	name: z
		.string()
		.min(1)
		.max(50)
		.regex(
			/^[a-zA-Z][a-zA-Z0-9_ ]*$/,
			"Must start with a letter, contain only letters, numbers, spaces, and underscores",
		),
	description: z.string().min(1).max(500),
	avatar: z.string().emoji().optional().or(z.literal("")),
	systemPrompt: z.string().min(1).max(5000),
	guidelines: z.string().max(2000).default(""),
	outputFormat: z.string().max(1000).default(""),
	modelId: z
		.enum(AVAILABLE_MODELS)
		.default("anthropic/claude-sonnet-4-20250514"),
	temperature: z
		.string()
		.regex(/^\d+(\.\d+)?$/)
		.default("0.7"),
	maxTokens: z.string().regex(/^\d+$/).default("4096"),
	topP: z
		.string()
		.regex(/^\d+(\.\d+)?$/)
		.default("1"),
	frequencyPenalty: z
		.string()
		.regex(/^-?\d+(\.\d+)?$/)
		.default("0"),
	presencePenalty: z
		.string()
		.regex(/^-?\d+(\.\d+)?$/)
		.default("0"),
	enabledTools: z.array(z.string()).default([]),
	needsApproval: z.boolean().optional().default(false),
	category: z
		.enum(AGENT_CATEGORIES.map((c) => c.value) as [string, ...string[]])
		.default("custom"),
});

// Template prompts for categories
const AGENT_TEMPLATES: Record<
	string,
	{ systemPrompt: string; guidelines: string; outputFormat: string }
> = {
	coding: {
		systemPrompt:
			"You are an expert coding assistant with deep knowledge of software development, algorithms, and best practices.",
		guidelines:
			"- Provide clear, well-commented code\n- Explain your reasoning\n- Suggest improvements and optimizations\n- Follow language-specific best practices\n- Consider edge cases and error handling",
		outputFormat:
			"Use markdown code blocks with language syntax highlighting. Include brief explanations before and after code.",
	},
	writing: {
		systemPrompt:
			"You are a professional writing assistant skilled in various writing styles and formats.",
		guidelines:
			"- Maintain consistent tone and voice\n- Focus on clarity and conciseness\n- Adapt to different audiences\n- Provide constructive feedback\n- Suggest improvements for flow and structure",
		outputFormat:
			"Use clear headings and paragraphs. Provide suggestions in bullet points when appropriate.",
	},
	analysis: {
		systemPrompt:
			"You are a data analyst with expertise in statistical analysis, data visualization, and deriving insights from data.",
		guidelines:
			"- Focus on key findings and patterns\n- Use appropriate statistical methods\n- Visualize data when helpful\n- Explain limitations and assumptions\n- Provide actionable recommendations",
		outputFormat:
			"Use structured reports with clear sections. Include visual elements using ASCII art or describe charts.",
	},
	research: {
		systemPrompt:
			"You are a research assistant skilled in finding, synthesizing, and presenting information from multiple sources.",
		guidelines:
			"- Verify information from multiple sources\n- Cite sources when applicable\n- Distinguish between facts and opinions\n- Identify knowledge gaps\n- Present balanced perspectives",
		outputFormat:
			"Use organized sections with clear headings. Include source citations when relevant.",
	},
	learning: {
		systemPrompt:
			"You are a patient learning tutor who excels at explaining complex concepts in accessible ways.",
		guidelines:
			"- Start with the basics and build up\n- Use analogies and examples\n- Check for understanding\n- Adapt to learning pace\n- Encourage curiosity and questions",
		outputFormat:
			"Use step-by-step explanations. Include examples and practice problems when helpful.",
	},
	custom: {
		systemPrompt: "",
		guidelines: "",
		outputFormat: "",
	},
};

// GET /api/agents - List all agents for user
agentsRouter.get("/", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		const db = createDb(c.env.DB);
		const agents = await db
			.select()
			.from(agent)
			.where(eq(agent.userId, user.id));

		return c.json({ agents });
	} catch (error) {
		console.error("Failed to list agents:", error);
		return c.json({ error: "Failed to list agents" }, 500);
	}
});

// GET /api/agents/templates - Get agent categories and templates
agentsRouter.get("/templates", async (c) => {
	return c.json({
		categories: AGENT_CATEGORIES,
		models: AVAILABLE_MODELS,
		templates: AGENT_TEMPLATES,
	});
});

// POST /api/agents - Create a new agent
agentsRouter.post("/", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		const body = await c.req.json();
		const validated = agentSchema.parse(body);

		const db = createDb(c.env.DB);

		// Check for duplicate name
		const existing = await db
			.select()
			.from(agent)
			.where(eq(agent.name, validated.name))
			.limit(1);

		if (existing.length > 0 && existing[0].userId === user.id) {
			return c.json({ error: "Agent with this name already exists" }, 400);
		}

		const newAgent = await db
			.insert(agent)
			.values({
				name: validated.name,
				description: validated.description,
				avatar: validated.avatar || null,
				systemPrompt: validated.systemPrompt,
				guidelines: validated.guidelines,
				outputFormat: validated.outputFormat,
				modelId: validated.modelId,
				temperature: validated.temperature,
				maxTokens: validated.maxTokens,
				topP: validated.topP,
				frequencyPenalty: validated.frequencyPenalty,
				presencePenalty: validated.presencePenalty,
				enabledTools: validated.enabledTools,
				needsApproval: validated.needsApproval,
				category: validated.category,
				userId: user.id,
			})
			.returning();

		return c.json({ agent: newAgent[0] }, 201);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: "Validation failed", details: error.errors }, 400);
		}
		console.error("Failed to create agent:", error);
		return c.json({ error: "Failed to create agent" }, 500);
	}
});

// GET /api/agents/:id - Get a specific agent
agentsRouter.get("/:id", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const agentId = c.req.param("id");

	try {
		const db = createDb(c.env.DB);
		const agents = await db
			.select()
			.from(agent)
			.where(eq(agent.id, agentId))
			.limit(1);

		if (agents.length === 0) {
			return c.json({ error: "Agent not found" }, 404);
		}

		const agentRecord = agents[0];
		if (agentRecord.userId !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		return c.json({ agent: agentRecord });
	} catch (error) {
		console.error("Failed to get agent:", error);
		return c.json({ error: "Failed to get agent" }, 500);
	}
});

// PUT /api/agents/:id - Update an agent
agentsRouter.put("/:id", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const agentId = c.req.param("id");

	try {
		const body = await c.req.json();
		const validated = agentSchema.parse(body);

		const db = createDb(c.env.DB);

		// Check ownership
		const existing = await db
			.select()
			.from(agent)
			.where(eq(agent.id, agentId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: "Agent not found" }, 404);
		}

		if (existing[0].userId !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		const updated = await db
			.update(agent)
			.set({
				name: validated.name,
				description: validated.description,
				avatar: validated.avatar || null,
				systemPrompt: validated.systemPrompt,
				guidelines: validated.guidelines,
				outputFormat: validated.outputFormat,
				modelId: validated.modelId,
				temperature: validated.temperature,
				maxTokens: validated.maxTokens,
				topP: validated.topP,
				frequencyPenalty: validated.frequencyPenalty,
				presencePenalty: validated.presencePenalty,
				enabledTools: validated.enabledTools,
				needsApproval: validated.needsApproval,
				category: validated.category,
				updatedAt: new Date(),
			})
			.where(eq(agent.id, agentId))
			.returning();

		return c.json({ agent: updated[0] });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: "Validation failed", details: error.errors }, 400);
		}
		console.error("Failed to update agent:", error);
		return c.json({ error: "Failed to update agent" }, 500);
	}
});

// DELETE /api/agents/:id - Delete an agent
agentsRouter.delete("/:id", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const agentId = c.req.param("id");

	try {
		const db = createDb(c.env.DB);

		// Check ownership
		const existing = await db
			.select()
			.from(agent)
			.where(eq(agent.id, agentId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: "Agent not found" }, 404);
		}

		if (existing[0].userId !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		await db.delete(agent).where(eq(agent.id, agentId));

		return c.json({ success: true });
	} catch (error) {
		console.error("Failed to delete agent:", error);
		return c.json({ error: "Failed to delete agent" }, 500);
	}
});

// PATCH /api/agents/:id/toggle - Toggle enabled state
agentsRouter.patch("/:id/toggle", async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const agentId = c.req.param("id");

	try {
		const db = createDb(c.env.DB);

		// Check ownership
		const existing = await db
			.select()
			.from(agent)
			.where(eq(agent.id, agentId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: "Agent not found" }, 404);
		}

		if (existing[0].userId !== user.id) {
			return c.json({ error: "Unauthorized" }, 403);
		}

		const updated = await db
			.update(agent)
			.set({
				isEnabled: !existing[0].isEnabled,
				updatedAt: new Date(),
			})
			.where(eq(agent.id, agentId))
			.returning();

		return c.json({ agent: updated[0] });
	} catch (error) {
		console.error("Failed to toggle agent:", error);
		return c.json({ error: "Failed to toggle agent" }, 500);
	}
});

export { agentsRouter };
