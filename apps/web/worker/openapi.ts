/**
 * OpenAPI 3.1 Specification for DuyetBot Web API
 *
 * This file contains the complete API documentation for all endpoints.
 * It follows OpenAPI 3.1.0 specification and can be served via Swagger UI.
 */

export const openApiSpec = {
	openapi: "3.1.0",
	info: {
		title: "DuyetBot Web API",
		version: "1.0.0",
		description:
			"AI Chat API with multi-model support, tool execution, and file uploads. " +
			"Built on Cloudflare Workers with D1 database and R2 storage.",
		contact: {
			name: "DuyetBot",
			url: "https://github.com/duyet/duyetbot-agent",
		},
		license: {
			name: "MIT",
			url: "https://opensource.org/licenses/MIT",
		},
	},
	servers: [
		{
			url: "https://duyetbot-web.duyet.workers.dev",
			description: "Production server",
		},
		{
			url: "http://localhost:3000",
			description: "Local development",
		},
	],
	tags: [
		{ name: "Auth", description: "Authentication and session management" },
		{ name: "Chat", description: "Chat conversations and messages" },
		{ name: "History", description: "Chat history management" },
		{ name: "Documents", description: "Artifacts and document management" },
		{ name: "Files", description: "File upload operations" },
		{ name: "Votes", description: "Message voting system" },
		{ name: "Suggestions", description: "AI-generated suggestions" },
		{ name: "Rate Limits", description: "Rate limiting status" },
		{ name: "Custom Tools", description: "User-defined custom tools" },
		{ name: "Health", description: "Service health checks" },
	],
	paths: {
		// Health Check
		"/health": {
			get: {
				tags: ["Health"],
				summary: "Health check",
				description: "Returns service health status and timestamp",
				operationId: "healthCheck",
				responses: {
					"200": {
						description: "Service is healthy",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										status: { type: "string", example: "ok" },
										timestamp: {
											type: "string",
											format: "date-time",
											example: "2025-12-28T12:00:00.000Z",
										},
									},
								},
							},
						},
					},
				},
			},
		},

		// Auth Routes
		"/api/auth/login": {
			post: {
				tags: ["Auth"],
				summary: "Login with email and password",
				description:
					"Authenticate user with email/password. Rate limited to 5 requests per minute. " +
					"Uses constant-time password verification to prevent timing attacks.",
				operationId: "login",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["email", "password"],
								properties: {
									email: {
										type: "string",
										format: "email",
										example: "user@example.com",
									},
									password: {
										type: "string",
										minLength: 8,
										example: "securepassword123",
									},
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Login successful",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AuthResponse" },
							},
						},
					},
					"401": {
						description: "Invalid credentials",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"429": {
						description: "Rate limit exceeded",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},
		"/api/auth/register": {
			post: {
				tags: ["Auth"],
				summary: "Register new user",
				description:
					"Create a new user account. Rate limited to 3 requests per minute. " +
					"Uses generic error messages to prevent user enumeration.",
				operationId: "register",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["email", "password"],
								properties: {
									email: {
										type: "string",
										format: "email",
										example: "newuser@example.com",
									},
									password: {
										type: "string",
										minLength: 8,
										example: "securepassword123",
									},
								},
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Registration successful",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AuthResponse" },
							},
						},
					},
					"400": {
						description: "Validation error or user exists",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"429": {
						description: "Rate limit exceeded",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},
		"/api/auth/logout": {
			post: {
				tags: ["Auth"],
				summary: "Logout current session",
				description: "Clear session cookie and invalidate token",
				operationId: "logout",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				responses: {
					"200": {
						description: "Logout successful",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/auth/session": {
			get: {
				tags: ["Auth"],
				summary: "Get current session",
				description: "Returns current user session information",
				operationId: "getSession",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				responses: {
					"200": {
						description: "Session info",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										user: { $ref: "#/components/schemas/User" },
										isGuest: { type: "boolean", example: false },
									},
								},
							},
						},
					},
					"401": {
						description: "Not authenticated",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},
		"/api/auth/guest": {
			get: {
				tags: ["Auth"],
				summary: "Create guest session",
				description:
					"Create a temporary guest user session with auto-generated credentials. " +
					"Guest sessions are rate limited to 10 messages per day.",
				operationId: "createGuestSession",
				responses: {
					"200": {
						description: "Guest session created",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AuthResponse" },
							},
						},
					},
				},
			},
		},
		"/api/auth/github": {
			get: {
				tags: ["Auth"],
				summary: "Initiate GitHub OAuth",
				description:
					"Redirects to GitHub for OAuth authentication with CSRF state parameter",
				operationId: "githubOAuth",
				responses: {
					"302": {
						description: "Redirect to GitHub OAuth",
						headers: {
							Location: {
								schema: { type: "string" },
								description: "GitHub OAuth URL",
							},
						},
					},
				},
			},
		},
		"/api/auth/github/callback": {
			get: {
				tags: ["Auth"],
				summary: "GitHub OAuth callback",
				description:
					"Handles GitHub OAuth callback, exchanges code for token and creates session",
				operationId: "githubCallback",
				parameters: [
					{
						name: "code",
						in: "query",
						required: true,
						schema: { type: "string" },
						description: "OAuth authorization code",
					},
					{
						name: "state",
						in: "query",
						required: true,
						schema: { type: "string" },
						description: "CSRF state parameter",
					},
				],
				responses: {
					"302": {
						description: "Redirect to app after successful auth",
					},
					"400": {
						description: "Invalid state or code",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		// Chat Routes
		"/api/chat": {
			post: {
				tags: ["Chat"],
				summary: "Send chat message",
				description:
					"Main chat endpoint with streaming AI response. Supports multimodal input (text + files). " +
					"Auto-creates guest session if needed. Rate limited: 10/day for guests, 60/min for authenticated users.",
				operationId: "sendMessage",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["id", "messages"],
								properties: {
									id: {
										type: "string",
										format: "uuid",
										description: "Chat ID",
									},
									messages: {
										type: "array",
										items: { $ref: "#/components/schemas/Message" },
									},
									selectedModelId: {
										type: "string",
										example: "anthropic/claude-sonnet-4-20250514",
										description: "Model to use for response",
									},
									customInstructions: {
										type: "string",
										description: "Custom system instructions",
									},
									experimental_attachments: {
										type: "array",
										items: { $ref: "#/components/schemas/Attachment" },
										description: "File attachments",
									},
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Streaming response",
						content: {
							"text/event-stream": {
								schema: { type: "string" },
							},
						},
					},
					"429": {
						description: "Rate limit exceeded",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
			delete: {
				tags: ["Chat"],
				summary: "Delete chat",
				description:
					"Delete a chat and all associated data (messages, votes, streams)",
				operationId: "deleteChat",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "query",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Chat ID to delete",
					},
				],
				responses: {
					"200": {
						description: "Chat deleted",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
									},
								},
							},
						},
					},
					"403": {
						description: "Not authorized to delete this chat",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},
		"/api/chat/{id}": {
			get: {
				tags: ["Chat"],
				summary: "Get chat by ID",
				description:
					"Fetch a chat with all its messages. Respects visibility settings (public/private).",
				operationId: "getChat",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Chat ID",
					},
				],
				responses: {
					"200": {
						description: "Chat data",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Chat" },
							},
						},
					},
					"404": {
						description: "Chat not found",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},
		"/api/chat/visibility": {
			patch: {
				tags: ["Chat"],
				summary: "Update chat visibility",
				description: "Set chat visibility to public or private",
				operationId: "updateVisibility",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["chatId", "visibility"],
								properties: {
									chatId: { type: "string", format: "uuid" },
									visibility: {
										type: "string",
										enum: ["public", "private"],
									},
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Visibility updated",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/chat/title": {
			post: {
				tags: ["Chat"],
				summary: "Generate chat title",
				description:
					"Generate a title for the chat using AI based on message content",
				operationId: "generateTitle",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["chatId", "message"],
								properties: {
									chatId: { type: "string", format: "uuid" },
									message: {
										type: "string",
										description: "First message content for title generation",
									},
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Title generated",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										title: { type: "string", example: "Help with React hooks" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/chat/branch": {
			post: {
				tags: ["Chat"],
				summary: "Branch chat",
				description:
					"Create a branched copy of chat at a specific message point",
				operationId: "branchChat",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["chatId", "messageId"],
								properties: {
									chatId: {
										type: "string",
										format: "uuid",
										description: "Source chat ID",
									},
									messageId: {
										type: "string",
										format: "uuid",
										description: "Message ID to branch from",
									},
								},
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Branch created",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										branchId: {
											type: "string",
											format: "uuid",
											description: "New branch chat ID",
										},
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/chat/messages/{id}": {
			delete: {
				tags: ["Chat"],
				summary: "Delete message",
				description: "Delete a single message by ID",
				operationId: "deleteMessage",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Message ID",
					},
				],
				responses: {
					"200": {
						description: "Message deleted",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/chat/messages/trailing": {
			delete: {
				tags: ["Chat"],
				summary: "Delete trailing messages",
				description: "Delete all messages after a specific timestamp",
				operationId: "deleteTrailingMessages",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["chatId", "timestamp"],
								properties: {
									chatId: { type: "string", format: "uuid" },
									timestamp: {
										type: "string",
										format: "date-time",
										description: "Delete messages after this time",
									},
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Messages deleted",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										deleted: {
											type: "integer",
											description: "Number of messages deleted",
										},
									},
								},
							},
						},
					},
				},
			},
		},

		// History Routes
		"/api/history": {
			get: {
				tags: ["History"],
				summary: "Get chat history",
				description:
					"Get paginated chat history for current user. Supports cursor-based pagination.",
				operationId: "getHistory",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "limit",
						in: "query",
						schema: { type: "integer", default: 10, maximum: 50 },
						description: "Number of chats to return",
					},
					{
						name: "starting_after",
						in: "query",
						schema: { type: "string", format: "uuid" },
						description: "Cursor for forward pagination",
					},
					{
						name: "ending_before",
						in: "query",
						schema: { type: "string", format: "uuid" },
						description: "Cursor for backward pagination",
					},
				],
				responses: {
					"200": {
						description: "Chat history",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										chats: {
											type: "array",
											items: { $ref: "#/components/schemas/ChatSummary" },
										},
										hasMore: { type: "boolean" },
									},
								},
							},
						},
					},
				},
			},
			delete: {
				tags: ["History"],
				summary: "Delete all chat history",
				description:
					"Delete all chats for current user (cascades to messages, votes, streams)",
				operationId: "deleteHistory",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				responses: {
					"200": {
						description: "History deleted",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
										deleted: {
											type: "integer",
											description: "Number of chats deleted",
										},
									},
								},
							},
						},
					},
				},
			},
		},

		// Document Routes
		"/api/document": {
			get: {
				tags: ["Documents"],
				summary: "Get document",
				description: "Get document/artifact by ID",
				operationId: "getDocument",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "query",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Document ID",
					},
				],
				responses: {
					"200": {
						description: "Document data",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Document" },
							},
						},
					},
					"404": {
						description: "Document not found",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
			post: {
				tags: ["Documents"],
				summary: "Save document",
				description: "Create or update document/artifact",
				operationId: "saveDocument",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "query",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Document ID",
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["content", "kind"],
								properties: {
									title: { type: "string" },
									content: { type: "string" },
									kind: {
										type: "string",
										enum: ["text", "code", "image", "sheet"],
									},
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Document saved",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Document" },
							},
						},
					},
				},
			},
			delete: {
				tags: ["Documents"],
				summary: "Delete document versions",
				description: "Delete document entries created after a timestamp",
				operationId: "deleteDocumentVersions",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "query",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Document ID",
					},
					{
						name: "timestamp",
						in: "query",
						required: true,
						schema: { type: "string", format: "date-time" },
						description: "Delete entries after this time",
					},
				],
				responses: {
					"200": {
						description: "Versions deleted",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
									},
								},
							},
						},
					},
				},
			},
		},

		// File Upload Routes
		"/api/files/upload": {
			post: {
				tags: ["Files"],
				summary: "Upload file",
				description:
					"Upload file to Cloudflare R2 storage. Max 10MB. Supports images, PDFs, text, and code files.",
				operationId: "uploadFile",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"multipart/form-data": {
							schema: {
								type: "object",
								properties: {
									file: {
										type: "string",
										format: "binary",
										description: "File to upload",
									},
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "File uploaded",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										url: {
											type: "string",
											format: "uri",
											description: "Public URL of uploaded file",
										},
										name: { type: "string" },
										contentType: { type: "string" },
									},
								},
							},
						},
					},
					"400": {
						description: "Invalid file type or size exceeded",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		// Vote Routes
		"/api/vote": {
			get: {
				tags: ["Votes"],
				summary: "Get votes for chat",
				description: "Get all votes (upvotes/downvotes) for messages in a chat",
				operationId: "getVotes",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "chatId",
						in: "query",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Chat ID",
					},
				],
				responses: {
					"200": {
						description: "Votes list",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: { $ref: "#/components/schemas/Vote" },
								},
							},
						},
					},
				},
			},
			patch: {
				tags: ["Votes"],
				summary: "Vote on message",
				description: "Upvote or downvote a message (upserts existing vote)",
				operationId: "voteMessage",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["chatId", "messageId", "type"],
								properties: {
									chatId: { type: "string", format: "uuid" },
									messageId: { type: "string", format: "uuid" },
									type: { type: "string", enum: ["up", "down"] },
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Vote recorded",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Vote" },
							},
						},
					},
				},
			},
		},

		// Suggestions Routes
		"/api/suggestions": {
			get: {
				tags: ["Suggestions"],
				summary: "Get suggestions",
				description: "Get AI-generated suggestions for a document",
				operationId: "getSuggestions",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "documentId",
						in: "query",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Document ID",
					},
				],
				responses: {
					"200": {
						description: "Suggestions list",
						content: {
							"application/json": {
								schema: {
									type: "array",
									items: { $ref: "#/components/schemas/Suggestion" },
								},
							},
						},
					},
				},
			},
		},

		// Rate Limit Routes
		"/api/rate-limit/status": {
			get: {
				tags: ["Rate Limits"],
				summary: "Get rate limit status",
				description:
					"Check current rate limit status. Guest: 10/day, Authenticated: 60/min.",
				operationId: "getRateLimitStatus",
				responses: {
					"200": {
						description: "Rate limit status",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RateLimitStatus" },
							},
						},
					},
				},
			},
		},

		// Custom Tools Routes
		"/api/tools/custom": {
			get: {
				tags: ["Custom Tools"],
				summary: "List custom tools",
				description: "Get all custom tools for the current user",
				operationId: "listCustomTools",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				responses: {
					"200": {
						description: "Custom tools list",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										tools: {
											type: "array",
											items: { $ref: "#/components/schemas/CustomTool" },
										},
									},
								},
							},
						},
					},
				},
			},
			post: {
				tags: ["Custom Tools"],
				summary: "Create custom tool",
				description:
					"Create a new custom tool with schema and action configuration",
				operationId: "createCustomTool",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CustomToolInput" },
						},
					},
				},
				responses: {
					"201": {
						description: "Tool created",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										tool: { $ref: "#/components/schemas/CustomTool" },
									},
								},
							},
						},
					},
					"400": {
						description: "Validation error",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},
		"/api/tools/custom/{id}": {
			get: {
				tags: ["Custom Tools"],
				summary: "Get custom tool",
				description: "Get a specific custom tool by ID",
				operationId: "getCustomTool",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Tool ID",
					},
				],
				responses: {
					"200": {
						description: "Tool data",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										tool: { $ref: "#/components/schemas/CustomTool" },
									},
								},
							},
						},
					},
					"404": {
						description: "Tool not found",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
			put: {
				tags: ["Custom Tools"],
				summary: "Update custom tool",
				description: "Update an existing custom tool",
				operationId: "updateCustomTool",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Tool ID",
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CustomToolInput" },
						},
					},
				},
				responses: {
					"200": {
						description: "Tool updated",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										tool: { $ref: "#/components/schemas/CustomTool" },
									},
								},
							},
						},
					},
				},
			},
			delete: {
				tags: ["Custom Tools"],
				summary: "Delete custom tool",
				description: "Delete a custom tool",
				operationId: "deleteCustomTool",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Tool ID",
					},
				],
				responses: {
					"200": {
						description: "Tool deleted",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/tools/custom/{id}/toggle": {
			patch: {
				tags: ["Custom Tools"],
				summary: "Toggle custom tool",
				description: "Toggle the enabled state of a custom tool",
				operationId: "toggleCustomTool",
				security: [{ bearerAuth: [] }, { cookieAuth: [] }],
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string", format: "uuid" },
						description: "Tool ID",
					},
				],
				responses: {
					"200": {
						description: "Tool toggled",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										tool: { $ref: "#/components/schemas/CustomTool" },
									},
								},
							},
						},
					},
				},
			},
		},
	},
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description: "JWT token in Authorization header",
			},
			cookieAuth: {
				type: "apiKey",
				in: "cookie",
				name: "session",
				description: "Session cookie",
			},
		},
		schemas: {
			Error: {
				type: "object",
				properties: {
					error: { type: "string", description: "Error message" },
					code: { type: "string", description: "Error code" },
					requestId: {
						type: "string",
						description: "Request ID for debugging",
					},
				},
				required: ["error"],
			},
			User: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					email: { type: "string", format: "email" },
					isGuest: { type: "boolean" },
					createdAt: { type: "string", format: "date-time" },
				},
			},
			AuthResponse: {
				type: "object",
				properties: {
					token: { type: "string", description: "JWT token" },
					user: { $ref: "#/components/schemas/User" },
				},
			},
			Message: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					role: { type: "string", enum: ["user", "assistant", "system"] },
					content: { type: "string" },
					createdAt: { type: "string", format: "date-time" },
					parts: {
						type: "array",
						items: {
							type: "object",
							properties: {
								type: { type: "string" },
								content: { type: "string" },
							},
						},
					},
				},
			},
			Attachment: {
				type: "object",
				properties: {
					name: { type: "string" },
					contentType: { type: "string" },
					url: { type: "string", format: "uri" },
				},
			},
			Chat: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					title: { type: "string" },
					userId: { type: "string", format: "uuid" },
					visibility: { type: "string", enum: ["public", "private"] },
					createdAt: { type: "string", format: "date-time" },
					messages: {
						type: "array",
						items: { $ref: "#/components/schemas/Message" },
					},
				},
			},
			ChatSummary: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					title: { type: "string" },
					visibility: { type: "string", enum: ["public", "private"] },
					createdAt: { type: "string", format: "date-time" },
				},
			},
			Document: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					title: { type: "string" },
					content: { type: "string" },
					kind: { type: "string", enum: ["text", "code", "image", "sheet"] },
					userId: { type: "string", format: "uuid" },
					createdAt: { type: "string", format: "date-time" },
				},
			},
			Vote: {
				type: "object",
				properties: {
					chatId: { type: "string", format: "uuid" },
					messageId: { type: "string", format: "uuid" },
					type: { type: "string", enum: ["up", "down"] },
				},
			},
			Suggestion: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					documentId: { type: "string", format: "uuid" },
					content: { type: "string" },
					createdAt: { type: "string", format: "date-time" },
				},
			},
			RateLimitStatus: {
				type: "object",
				properties: {
					isGuest: { type: "boolean" },
					limit: {
						type: "integer",
						description: "Total requests allowed in window",
					},
					remaining: { type: "integer", description: "Remaining requests" },
					resetAt: {
						type: "string",
						format: "date-time",
						description: "When limit resets",
					},
					resetInSeconds: {
						type: "integer",
						description: "Seconds until reset",
					},
					windowDescription: {
						type: "string",
						example: "10 messages per day",
					},
				},
			},
			CustomTool: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					name: { type: "string", pattern: "^[a-z][a-z0-9_]*$" },
					description: { type: "string" },
					parameters: {
						type: "array",
						items: {
							type: "object",
							properties: {
								name: { type: "string" },
								type: { type: "string", enum: ["string", "number", "boolean"] },
								description: { type: "string" },
								required: { type: "boolean" },
							},
						},
					},
					actionType: {
						type: "string",
						enum: ["http_fetch", "code_execution", "mcp_call"],
					},
					actionConfig: { type: "object" },
					needsApproval: { type: "boolean" },
					isEnabled: { type: "boolean" },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			CustomToolInput: {
				type: "object",
				required: [
					"name",
					"description",
					"inputSchema",
					"actionType",
					"actionConfig",
				],
				properties: {
					name: {
						type: "string",
						pattern: "^[a-z][a-z0-9_]*$",
						minLength: 1,
						maxLength: 50,
						description: "Snake_case tool name starting with letter",
					},
					description: { type: "string", minLength: 1, maxLength: 500 },
					inputSchema: {
						type: "object",
						properties: {
							type: { type: "string", enum: ["object"] },
							properties: {
								type: "object",
								additionalProperties: {
									type: "object",
									properties: {
										type: {
											type: "string",
											enum: ["string", "number", "boolean"],
										},
										description: { type: "string" },
									},
								},
							},
							required: { type: "array", items: { type: "string" } },
						},
					},
					actionType: {
						type: "string",
						enum: ["http_fetch", "code_execution", "mcp_call"],
					},
					actionConfig: {
						oneOf: [
							{
								type: "object",
								title: "HTTP Fetch Config",
								properties: {
									url: { type: "string", format: "uri" },
									method: {
										type: "string",
										enum: ["GET", "POST", "PUT", "DELETE"],
									},
									headers: {
										type: "object",
										additionalProperties: { type: "string" },
									},
									bodyTemplate: { type: "string" },
								},
								required: ["url", "method"],
							},
							{
								type: "object",
								title: "Code Execution Config",
								properties: {
									code: { type: "string" },
									language: { type: "string", enum: ["javascript", "python"] },
								},
								required: ["code", "language"],
							},
							{
								type: "object",
								title: "MCP Call Config",
								properties: {
									serverUrl: { type: "string", format: "uri" },
									toolName: { type: "string" },
								},
								required: ["serverUrl", "toolName"],
							},
						],
					},
					needsApproval: { type: "boolean", default: false },
				},
			},
		},
	},
};
