import type { InferSelectModel } from "drizzle-orm";
import {
	foreignKey,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("User", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text("email").notNull(),
	password: text("password"),
	name: text("name"),
	githubId: text("githubId").unique(),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type User = InferSelectModel<typeof user>;

export const chat: any = sqliteTable("Chat", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	title: text("title").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, {
			onDelete: "no action",
			onUpdate: "no action",
		}),
	visibility: text("visibility", { enum: ["public", "private"] })
		.notNull()
		.default("private"),
	// Chat branching fields
	parentChatId: text("parentChatId").references(() => chat.id, {
		onDelete: "set null",
		onUpdate: "no action",
	}),
	branchPoint: integer("branchPoint", { mode: "timestamp" }),
	// Chat sharing fields
	shareId: text("shareId").unique(),
	shareToken: text("shareToken"),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = sqliteTable("Message", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	chatId: text("chatId")
		.notNull()
		.references(() => chat.id, {
			onDelete: "no action",
			onUpdate: "no action",
		}),
	role: text("role").notNull(),
	content: text("content", { mode: "json" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = sqliteTable("Message_v2", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	chatId: text("chatId")
		.notNull()
		.references(() => chat.id, {
			onDelete: "no action",
			onUpdate: "no action",
		}),
	role: text("role").notNull(),
	parts: text("parts", { mode: "json" }).notNull(),
	attachments: text("attachments", { mode: "json" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = sqliteTable(
	"Vote",
	{
		chatId: text("chatId")
			.notNull()
			.references(() => chat.id, {
				onDelete: "no action",
				onUpdate: "no action",
			}),
		messageId: text("messageId")
			.notNull()
			.references(() => messageDeprecated.id, {
				onDelete: "no action",
				onUpdate: "no action",
			}),
		isUpvoted: integer("isUpvoted", { mode: "boolean" }).notNull(),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.chatId, table.messageId] }),
		};
	},
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = sqliteTable(
	"Vote_v2",
	{
		chatId: text("chatId")
			.notNull()
			.references(() => chat.id, {
				onDelete: "no action",
				onUpdate: "no action",
			}),
		messageId: text("messageId")
			.notNull()
			.references(() => message.id, {
				onDelete: "no action",
				onUpdate: "no action",
			}),
		isUpvoted: integer("isUpvoted", { mode: "boolean" }).notNull(),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.chatId, table.messageId] }),
		};
	},
);

export type Vote = InferSelectModel<typeof vote>;

export const document = sqliteTable(
	"Document",
	{
		id: text("id").$defaultFn(() => crypto.randomUUID()),
		createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
		title: text("title").notNull(),
		content: text("content"),
		kind: text("text", { enum: ["text", "code", "image", "sheet", "chart"] })
			.notNull()
			.default("text"),
		userId: text("userId")
			.notNull()
			.references(() => user.id, {
				onDelete: "no action",
				onUpdate: "no action",
			}),
		// Document sharing fields
		shareId: text("shareId").unique(),
		shareToken: text("shareToken"),
		isPublic: integer("isPublic", { mode: "boolean" }).notNull().default(false),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.id, table.createdAt] }),
		};
	},
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = sqliteTable(
	"Suggestion",
	{
		id: text("id").$defaultFn(() => crypto.randomUUID()),
		documentId: text("documentId").notNull(),
		documentCreatedAt: integer("documentCreatedAt", {
			mode: "timestamp",
		}).notNull(),
		originalText: text("originalText").notNull(),
		suggestedText: text("suggestedText").notNull(),
		description: text("description"),
		isResolved: integer("isResolved", { mode: "boolean" })
			.notNull()
			.default(false),
		userId: text("userId")
			.notNull()
			.references(() => user.id, {
				onDelete: "no action",
				onUpdate: "no action",
			}),
		createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.id] }),
		documentRef: foreignKey({
			columns: [table.documentId, table.documentCreatedAt],
			foreignColumns: [document.id, document.createdAt],
		}),
	}),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = sqliteTable(
	"Stream",
	{
		id: text("id").$defaultFn(() => crypto.randomUUID()),
		chatId: text("chatId").notNull(),
		createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.id] }),
		chatRef: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
		}),
	}),
);

export type Stream = InferSelectModel<typeof stream>;

// Chat folders for organizing conversations
export const chatFolder = sqliteTable("ChatFolder", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
			onUpdate: "no action",
		}),
	color: text("color").notNull().default("#3b82f6"),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type ChatFolder = InferSelectModel<typeof chatFolder>;

// Chat to folder junction table
export const chatToFolder = sqliteTable(
	"ChatToFolder",
	{
		chatId: text("chatId")
			.notNull()
			.references(() => chat.id, {
				onDelete: "cascade",
				onUpdate: "no action",
			}),
		folderId: text("folderId")
			.notNull()
			.references(() => chatFolder.id, {
				onDelete: "cascade",
				onUpdate: "no action",
			}),
		createdAt: integer("createdAt", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.chatId, table.folderId] }),
		};
	},
);

export type ChatToFolder = InferSelectModel<typeof chatToFolder>;

// Chat tags for labeling conversations
export const chatTag = sqliteTable("ChatTag", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull().unique(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
			onUpdate: "no action",
		}),
	color: text("color").notNull().default("#10b981"),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type ChatTag = InferSelectModel<typeof chatTag>;

// Chat to tag junction table
export const chatToTag = sqliteTable(
	"ChatToTag",
	{
		chatId: text("chatId")
			.notNull()
			.references(() => chat.id, {
				onDelete: "cascade",
				onUpdate: "no action",
			}),
		tagId: text("tagId")
			.notNull()
			.references(() => chatTag.id, {
				onDelete: "cascade",
				onUpdate: "no action",
			}),
		createdAt: integer("createdAt", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.chatId, table.tagId] }),
		};
	},
);

export type ChatToTag = InferSelectModel<typeof chatToTag>;

// Custom user-defined tools
export const customTool = sqliteTable("CustomTool", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	description: text("description").notNull(),
	// JSON schema for tool parameters (Zod-compatible format)
	inputSchema: text("inputSchema", { mode: "json" }).notNull(),
	// Action type: http_fetch, code_execution, mcp_call
	actionType: text("actionType", {
		enum: ["http_fetch", "code_execution", "mcp_call"],
	}).notNull(),
	// Action configuration (URL template, code, MCP endpoint)
	actionConfig: text("actionConfig", { mode: "json" }).notNull(),
	// Whether this tool requires user approval before execution
	needsApproval: integer("needsApproval", { mode: "boolean" })
		.notNull()
		.default(false),
	// Enabled/disabled state
	isEnabled: integer("isEnabled", { mode: "boolean" }).notNull().default(true),
	userId: text("userId")
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
			onUpdate: "no action",
		}),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type CustomTool = InferSelectModel<typeof customTool>;

// Custom AI agents/personas
export const agent = sqliteTable("Agent", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	description: text("description").notNull(),
	// Agent identity and persona
	avatar: text("avatar"), // Emoji or icon for the agent
	// System prompt sections
	systemPrompt: text("systemPrompt").notNull(),
	// Behavior guidelines
	guidelines: text("guidelines").notNull().default(""),
	// Output format preferences
	outputFormat: text("outputFormat").notNull().default(""),
	// Model parameters
	modelId: text("modelId")
		.notNull()
		.default("anthropic/claude-sonnet-4-20250514"),
	temperature: text("temperature", { mode: "json" }).notNull().default("0.7"),
	maxTokens: text("maxTokens", { mode: "json" }).notNull().default("4096"),
	topP: text("topP", { mode: "json" }).notNull().default("1"),
	frequencyPenalty: text("frequencyPenalty", { mode: "json" })
		.notNull()
		.default("0"),
	presencePenalty: text("presencePenalty", { mode: "json" })
		.notNull()
		.default("0"),
	// Tools this agent has access to (array of tool IDs)
	enabledTools: text("enabledTools", {
		mode: "json",
	})
		.$type<string[]>()
		.default([]),
	// Whether this agent requires user approval before execution
	needsApproval: integer("needsApproval", { mode: "boolean" })
		.notNull()
		.default(false),
	// Enabled/disabled state
	isEnabled: integer("isEnabled", { mode: "boolean" }).notNull().default(true),
	// Agent category/template (custom, coding, writing, analysis, etc.)
	category: text("category").notNull().default("custom"),
	userId: text("userId")
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
			onUpdate: "no action",
		}),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type Agent = InferSelectModel<typeof agent>;

// User sessions for secure session management
// Enables session invalidation, rotation, and fixation prevention
export const sessions = sqliteTable("Session", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
			onUpdate: "no action",
		}),
	// Session token hash for verification (not stored in plaintext)
	tokenHash: text("tokenHash").notNull().unique(),
	// When the session was created
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	// When the session expires (30 days from creation by default)
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	// Last activity time for session timeout detection
	lastActivityAt: integer("lastActivityAt", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	// User agent and IP for session verification (optional)
	userAgent: text("userAgent"),
	ipAddress: text("ipAddress"),
	// Whether this session was rotated from a previous session (prevents fixation)
	isRotated: integer("isRotated", { mode: "boolean" }).notNull().default(false),
	// ID of the session this replaced (for rotation tracking)
	replacedSessionId: text("replacedSessionId").references(
		(): any => sessions.id,
		{
			onDelete: "set null",
			onUpdate: "no action",
		},
	),
});

export type DbSession = InferSelectModel<typeof sessions>;

// Security audit log for tracking sensitive operations
// Provides audit trail for security events and compliance
export const auditLog = sqliteTable("AuditLog", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	// User who performed the action (nullable for system events)
	userId: text("userId").references(() => user.id, {
		onDelete: "set null",
		onUpdate: "no action",
	}),
	// Action type (login, logout, session_created, session_invalidated, session_rotated, password_change, etc.)
	action: text("action").notNull(),
	// Resource affected (sessionId, userId, etc.)
	resourceType: text("resourceType"), // "session", "user", "document", etc.
	resourceId: text("resourceId"),
	// Operation outcome
	success: integer("success", { mode: "boolean" }).notNull(),
	// Error message if operation failed
	errorMessage: text("errorMessage"),
	// Request metadata for security analysis
	userAgent: text("userAgent"),
	ipAddress: text("ipAddress"),
	// Additional context (JSON)
	metadata: text("metadata", { mode: "json" }),
	// When the action occurred
	timestamp: integer("timestamp", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type AuditLog = InferSelectModel<typeof auditLog>;
