/**
 * Mention Parser for Worker
 * Parses @ mentions from user messages to identify explicitly requested tools
 *
 * When users type @websearch or @weather, the AI should prioritize those tools.
 */

// Map of aliases to tool IDs for flexible matching
const TOOL_ALIASES: Record<string, string> = {
	// Web search aliases
	websearch: "web_search",
	search: "web_search",
	google: "web_search",
	web: "web_search",
	web_search: "web_search",
	// URL fetch aliases
	urlfetch: "url_fetch",
	url: "url_fetch",
	fetch: "url_fetch",
	link: "url_fetch",
	url_fetch: "url_fetch",
	// Duyet MCP aliases
	duyetmcp: "duyet_mcp",
	duyet: "duyet_mcp",
	mcp: "duyet_mcp",
	profile: "duyet_mcp",
	duyet_mcp: "duyet_mcp",
	// Plan aliases
	plan: "plan",
	task: "plan",
	tasks: "plan",
	breakdown: "plan",
	// Scratchpad aliases
	scratchpad: "scratchpad",
	scratch: "scratchpad",
	notes: "scratchpad",
	note: "scratchpad",
	clipboard: "scratchpad",
	// Weather aliases
	getweather: "getWeather",
	weather: "getWeather",
	forecast: "getWeather",
};

// Pattern to match @mentions - alphanumeric + underscore
const MENTION_PATTERN = /@([a-zA-Z_][a-zA-Z0-9_]*)/g;

/**
 * Resolve a mention string to a tool ID
 */
export function resolveToolId(mention: string): string | null {
	const normalized = mention.toLowerCase();
	return TOOL_ALIASES[normalized] ?? null;
}

/**
 * Parse input text and extract all mentioned tool IDs
 * Returns deduplicated list of tool IDs
 */
export function parseMentionedTools(text: string): string[] {
	const mentionedToolIds: string[] = [];
	const pattern = new RegExp(MENTION_PATTERN.source, "g");

	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text)) !== null) {
		const mentionText = match[1];
		const toolId = resolveToolId(mentionText);

		if (toolId && !mentionedToolIds.includes(toolId)) {
			mentionedToolIds.push(toolId);
		}
	}

	return mentionedToolIds;
}

/**
 * Get clean text with mentions removed
 */
export function getCleanText(text: string): string {
	const pattern = new RegExp(MENTION_PATTERN.source, "g");
	return text
		.replace(pattern, (match, mention) => {
			// Only remove if it's a valid tool mention
			return resolveToolId(mention) ? "" : match;
		})
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Build a tool hint string for the system prompt
 * Returns empty string if no tools mentioned
 */
export function buildToolHint(mentionedTools: string[]): string {
	if (mentionedTools.length === 0) {
		return "";
	}

	const toolDescriptions: Record<string, string> = {
		web_search: "search the web for current information",
		url_fetch: "fetch and extract content from a URL",
		duyet_mcp: "access information about Duyet (profile, CV, blog, GitHub)",
		plan: "create a task breakdown and planning",
		scratchpad: "store or retrieve temporary notes",
		getWeather: "get current weather information",
	};

	const descriptions = mentionedTools
		.map((id) => `- ${id}: ${toolDescriptions[id] || id}`)
		.join("\n");

	return `
IMPORTANT: The user has explicitly requested the following tools via @ mentions. Please USE these tools in your response:
${descriptions}

Proceed to use these tools now to fulfill the user's request.`;
}
