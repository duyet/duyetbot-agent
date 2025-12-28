/**
 * Mention Parser - Parse and extract @ mentions from chat input
 *
 * Supports mentioning tools like @websearch, @weather, @plan, etc.
 * When users type @, autocomplete suggestions appear.
 * Mentions are highlighted in the input and passed to the backend.
 */

/**
 * Tool definition for mention autocomplete
 */
export interface MentionableTool {
	id: string;
	name: string;
	description: string;
	icon?: string;
}

/**
 * Available tools that can be mentioned
 */
export const MENTIONABLE_TOOLS: MentionableTool[] = [
	{
		id: "web_search",
		name: "Web Search",
		description: "Search the web using DuckDuckGo",
		icon: "search",
	},
	{
		id: "url_fetch",
		name: "URL Fetch",
		description: "Extract text content from a URL",
		icon: "link",
	},
	{
		id: "duyet_mcp",
		name: "Duyet MCP",
		description: "Access Duyet's profile, CV, blog, and GitHub",
		icon: "user",
	},
	{
		id: "plan",
		name: "Plan",
		description: "Create a task breakdown and planning",
		icon: "list",
	},
	{
		id: "scratchpad",
		name: "Scratchpad",
		description: "Store and retrieve temporary notes",
		icon: "clipboard",
	},
	{
		id: "getWeather",
		name: "Weather",
		description: "Get current weather for a location",
		icon: "cloud",
	},
];

/**
 * Parsed mention from input text
 */
export interface ParsedMention {
	/** The tool ID (e.g., "web_search") */
	toolId: string;
	/** Start index in the original text */
	startIndex: number;
	/** End index in the original text */
	endIndex: number;
	/** The matched text (e.g., "@websearch") */
	matchedText: string;
}

/**
 * Result of parsing input text for mentions
 */
export interface ParsedInput {
	/** Clean text with mentions removed or replaced */
	cleanText: string;
	/** List of mentioned tools */
	mentions: ParsedMention[];
	/** Tool IDs that were mentioned */
	mentionedToolIds: string[];
}

/**
 * Match info for autocomplete trigger detection
 */
export interface MentionTrigger {
	/** Whether we're in a mention context (after @) */
	isActive: boolean;
	/** The partial query after @ */
	query: string;
	/** Start position of the @ in the text */
	startIndex: number;
	/** Current cursor position */
	cursorPosition: number;
}

// Regex to match @mentions - alphanumeric + underscore, case insensitive
const MENTION_REGEX = /@([a-zA-Z_][a-zA-Z0-9_]*)/g;

// Map of aliases to tool IDs for flexible matching
const TOOL_ALIASES: Record<string, string> = {
	// Web search aliases
	websearch: "web_search",
	search: "web_search",
	google: "web_search",
	web: "web_search",
	// URL fetch aliases
	urlfetch: "url_fetch",
	url: "url_fetch",
	fetch: "url_fetch",
	link: "url_fetch",
	// Duyet MCP aliases
	duyetmcp: "duyet_mcp",
	duyet: "duyet_mcp",
	mcp: "duyet_mcp",
	profile: "duyet_mcp",
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

/**
 * Resolve a mention string to a tool ID
 */
export function resolveToolId(mention: string): string | null {
	const normalized = mention.toLowerCase();
	return TOOL_ALIASES[normalized] ?? null;
}

/**
 * Parse input text and extract all mentions
 */
export function parseMentions(text: string): ParsedInput {
	const mentions: ParsedMention[] = [];
	const mentionedToolIds: string[] = [];

	let match: RegExpExecArray | null;
	const regex = new RegExp(MENTION_REGEX);

	while ((match = regex.exec(text)) !== null) {
		const mentionText = match[1];
		const toolId = resolveToolId(mentionText);

		if (toolId) {
			mentions.push({
				toolId,
				startIndex: match.index,
				endIndex: match.index + match[0].length,
				matchedText: match[0],
			});

			if (!mentionedToolIds.includes(toolId)) {
				mentionedToolIds.push(toolId);
			}
		}
	}

	// Remove mentions from text for clean display
	let cleanText = text;
	// Process in reverse order to preserve indices
	for (const mention of [...mentions].reverse()) {
		cleanText =
			cleanText.slice(0, mention.startIndex) +
			cleanText.slice(mention.endIndex);
	}
	cleanText = cleanText.replace(/\s+/g, " ").trim();

	return {
		cleanText,
		mentions,
		mentionedToolIds,
	};
}

/**
 * Detect if we're currently in a mention context for autocomplete
 */
export function detectMentionTrigger(
	text: string,
	cursorPosition: number,
): MentionTrigger {
	// Find the last @ before cursor
	const textBeforeCursor = text.slice(0, cursorPosition);
	const lastAtIndex = textBeforeCursor.lastIndexOf("@");

	if (lastAtIndex === -1) {
		return { isActive: false, query: "", startIndex: -1, cursorPosition };
	}

	// Check if there's a space between @ and cursor (mention completed/cancelled)
	const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
	if (textAfterAt.includes(" ")) {
		return { isActive: false, query: "", startIndex: -1, cursorPosition };
	}

	// Check if @ is at start or preceded by whitespace
	if (lastAtIndex > 0 && !/\s/.test(text[lastAtIndex - 1])) {
		return { isActive: false, query: "", startIndex: -1, cursorPosition };
	}

	return {
		isActive: true,
		query: textAfterAt,
		startIndex: lastAtIndex,
		cursorPosition,
	};
}

/**
 * Filter tools based on query for autocomplete
 */
export function filterTools(
	query: string,
	tools: MentionableTool[] = MENTIONABLE_TOOLS,
): MentionableTool[] {
	if (!query) {
		return tools;
	}

	const normalizedQuery = query.toLowerCase();

	return tools.filter((tool) => {
		// Match by ID
		if (tool.id.toLowerCase().includes(normalizedQuery)) {
			return true;
		}
		// Match by name
		if (tool.name.toLowerCase().includes(normalizedQuery)) {
			return true;
		}
		// Match by aliases
		const matchingAlias = Object.entries(TOOL_ALIASES).find(
			([alias, toolId]) =>
				toolId === tool.id && alias.includes(normalizedQuery),
		);
		return !!matchingAlias;
	});
}

/**
 * Complete a mention in the input text
 */
export function completeMention(
	text: string,
	trigger: MentionTrigger,
	tool: MentionableTool,
): { newText: string; newCursorPosition: number } {
	const beforeMention = text.slice(0, trigger.startIndex);
	const afterCursor = text.slice(trigger.cursorPosition);

	// Insert the completed mention
	// Only add trailing space if there isn't already whitespace after cursor
	const needsSpace = afterCursor.length === 0 || !/^\s/.test(afterCursor);
	const mentionText = `@${tool.id}${needsSpace ? " " : ""}`;
	const newText = beforeMention + mentionText + afterCursor;
	const newCursorPosition = trigger.startIndex + mentionText.length;

	return { newText, newCursorPosition };
}

/**
 * Get tool by ID
 */
export function getToolById(
	toolId: string,
	tools: MentionableTool[] = MENTIONABLE_TOOLS,
): MentionableTool | undefined {
	return tools.find((tool) => tool.id === toolId);
}
