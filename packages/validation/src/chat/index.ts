/**
 * Chat validation schemas
 *
 * Validation schemas for chat messages, parts, and related structures.
 */

import { z } from 'zod';
import { uuidSchema } from '../common/index.js';

/**
 * Media type enums for file parts
 */
export const imageMediaTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

export const documentMediaTypes = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
] as const;

export const codeMediaTypes = [
  'text/javascript',
  'text/typescript',
  'application/json',
  'text/html',
  'text/css',
  'text/xml',
  'application/xml',
] as const;

export const allMediaTypes = [
  ...imageMediaTypes,
  ...documentMediaTypes,
  ...codeMediaTypes,
] as const;

/**
 * Chat message part schemas
 */

/**
 * Text part schema for chat messages
 */
export const chatMessagePartSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(2000, 'Message text must be between 1 and 2000 characters'),
});

/**
 * File part schema for chat attachments
 */
export const filePartSchema = z.object({
  type: z.literal('file'),
  mediaType: z.enum(allMediaTypes),
  name: z.string().min(1).max(255, 'File name must be between 1 and 255 characters'),
  url: z.string().url('Invalid file URL'),
});

/**
 * Union schema for all message parts
 */
export const partSchema = z.union([chatMessagePartSchema, filePartSchema]);

/**
 * Message part array schema
 */
export const partsSchema = z.array(partSchema).min(1, 'At least one part is required');

/**
 * Message role schema
 */
export const messageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);

/**
 * Basic message schema
 */
export const messageSchema = z.object({
  id: z.string(),
  role: messageRoleSchema,
  parts: z.array(z.any()),
});

/**
 * User message schema
 */
export const userMessageSchema = z.object({
  id: uuidSchema,
  role: z.literal('user'),
  parts: partsSchema,
});

/**
 * Assistant message schema
 */
export const assistantMessageSchema = z.object({
  id: uuidSchema,
  role: z.literal('assistant'),
  parts: partsSchema,
});

/**
 * Chat visibility schema
 */
export const chatVisibilitySchema = z.enum(['public', 'private']);

/**
 * Chat ID schema
 */
export const chatIdSchema = uuidSchema;

/**
 * Chat title schema
 */
export const chatTitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(200, 'Title must be at most 200 characters');

/**
 * Chat metadata schema
 */
export const chatMetadataSchema = z.object({
  createdAt: z.date().or(z.number().transform((val: number) => new Date(val))),
  updatedAt: z.date().or(z.number().transform((val: number) => new Date(val))).optional(),
  messageCount: z.number().int().nonnegative().optional(),
  lastMessageAt: z.date().or(z.number().transform((val: number) => new Date(val))).optional(),
});

/**
 * Chat schema
 */
export const chatSchema = z.object({
  id: chatIdSchema,
  title: chatTitleSchema,
  visibility: chatVisibilitySchema,
  userId: z.string().min(1, 'User ID is required'),
  createdAt: z.date().or(z.number().transform((val: number) => new Date(val))),
  updatedAt: z.date().or(z.number().transform((val: number) => new Date(val))).optional(),
  parentChatId: chatIdSchema.optional(),
  branchPoint: z.date().or(z.number().transform((val: number) => new Date(val))).optional(),
});

/**
 * Chat request body schema for creating/sending messages
 */
export const postRequestBodySchema = z.object({
  id: chatIdSchema,
  message: userMessageSchema.optional(),
  messages: z.array(messageSchema).optional(),
  selectedChatModel: z.string().min(1, 'Model selection is required'),
  selectedVisibilityType: chatVisibilitySchema,
  customInstructions: z.string().max(5000, 'Custom instructions must be at most 5000 characters').optional(),
  aiSettings: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
      topP: z.number().min(0).max(1).optional(),
      frequencyPenalty: z.number().min(-2).max(2).optional(),
      presencePenalty: z.number().min(-2).max(2).optional(),
    })
    .optional(),
});

/**
 * Chat visibility update schema
 */
export const updateVisibilitySchema = z.object({
  chatId: chatIdSchema,
  visibility: chatVisibilitySchema,
});

/**
 * Delete trailing messages schema
 */
export const deleteTrailingMessagesSchema = z.object({
  messageId: uuidSchema,
});

/**
 * Chat branch schema
 */
export const branchRequestSchema = z.object({
  chatId: z.string().min(1, 'Chat ID is required'),
  messageId: uuidSchema.optional(),
});

/**
 * Title generation request schema
 */
export const titleRequestSchema = z.object({
  chatId: chatIdSchema,
  message: z.string().min(1, 'Message is required for title generation'),
});

/**
 * Message deletion schema
 */
export const deleteMessageSchema = z.object({
  messageId: uuidSchema,
});

/**
 * Vote schema for message voting
 */
export const voteSchema = z.object({
  messageId: uuidSchema,
  chatId: chatIdSchema,
  direction: z.enum(['up', 'down']),
});

/**
 * Chat list query schema
 */
export const chatListQuerySchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(20),
  offset: z.number().int().nonnegative().optional().default(0),
  visibility: chatVisibilitySchema.optional(),
  search: z.string().optional(),
});

/**
 * Chat history query schema
 */
export const chatHistoryQuerySchema = z.object({
  chatId: chatIdSchema,
  limit: z.number().int().positive().max(100).optional().default(50),
  before: z.date().or(z.number().transform((val: number) => new Date(val))).optional(),
});

// Type exports
export type ChatMessagePart = z.infer<typeof chatMessagePartSchema>;
export type FilePart = z.infer<typeof filePartSchema>;
export type Part = z.infer<typeof partSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type Message = z.infer<typeof messageSchema>;
export type UserMessage = z.infer<typeof userMessageSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type ChatVisibility = z.infer<typeof chatVisibilitySchema>;
export type Chat = z.infer<typeof chatSchema>;
export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
export type UpdateVisibilityInput = z.infer<typeof updateVisibilitySchema>;
export type DeleteTrailingMessagesInput = z.infer<typeof deleteTrailingMessagesSchema>;
export type BranchRequestInput = z.infer<typeof branchRequestSchema>;
export type TitleRequestInput = z.infer<typeof titleRequestSchema>;
export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;
export type Vote = z.infer<typeof voteSchema>;
export type ChatListQuery = z.infer<typeof chatListQuerySchema>;
export type ChatHistoryQuery = z.infer<typeof chatHistoryQuerySchema>;
