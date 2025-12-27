import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, like, and, desc, inArray, or, sql } from "drizzle-orm";
import { createDb } from "@/lib/db";
import { chat, message, chatTag, chatToTag, chatFolder, chatToFolder } from "@/lib/db/schema";

export interface SearchOptions {
  userId: string;
  query: string;
  folderId?: string;
  tagIds?: string[];
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt?: Date;
  visibility: string;
  snippet?: string;
  matchedMessages: number;
  tags: Array<{ id: string; name: string; color: string }>;
  folders: Array<{ id: string; name: string; color: string }>;
}

async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return createDb(env.DB);
}

/**
 * Search chats using full-text search across title and messages
 * Uses SQLite LIKE operator for text matching
 */
export async function searchChats(options: SearchOptions): Promise<SearchResult[]> {
  const { userId, query, folderId, tagIds, limit = 20 } = options;
  const db = await getDb();

  // Build search conditions
  const conditions = [
    eq(chat.userId, userId),
    // Search in title
    like(chat.title, `%${query}%`),
  ];

  // If we have a folder filter, include chats in that folder
  if (folderId) {
    const folderChats = await db
      .select({ chatId: chatToFolder.chatId })
      .from(chatToFolder)
      .where(eq(chatToFolder.folderId, folderId));

    const chatIds = folderChats.map((fc) => fc.chatId);
    if (chatIds.length === 0) {
      return []; // No chats in this folder
    }
    conditions.push(sql`${chat.id} IN ${chatIds}`);
  }

  // If we have tag filters, include chats with those tags
  if (tagIds && tagIds.length > 0) {
    const taggedChats = await db
      .selectDistinct({ chatId: chatToTag.chatId })
      .from(chatToTag)
      .where(inArray(chatToTag.tagId, tagIds));

    const chatIds = taggedChats.map((tc) => tc.chatId);
    if (chatIds.length === 0) {
      return []; // No chats with these tags
    }
    conditions.push(sql`${chat.id} IN ${chatIds}`);
  }

  // Search chats matching title
  const chats = await db
    .select()
    .from(chat)
    .where(and(...conditions))
    .orderBy(desc(chat.createdAt))
    .limit(limit);

  // Get messages for all found chats
  const chatIds = chats.map((c) => c.id);
  const allMessages = chatIds.length > 0
    ? await db
        .select()
        .from(message)
        .where(inArray(message.chatId, chatIds))
    : [];

  // Search in message content too
  const messageMatches = await db
    .select()
    .from(message)
    .where(like(message.parts, `%${query}%`))
    .orderBy(desc(message.createdAt))
    .limit(limit);

  // Get unique chat IDs from message matches that aren't already included
  const messageMatchChatIds = Array.from(
    new Set(messageMatches.map((m) => m.chatId))
  ).filter((id) => !chatIds.includes(id));

  // Get additional chats that matched via messages
  let additionalChats: typeof chats = [];
  if (messageMatchChatIds.length > 0) {
    additionalChats = await db
      .select()
      .from(chat)
      .where(and(
        eq(chat.userId, userId),
        inArray(chat.id, messageMatchChatIds)
      ));

    // Get messages for additional chats
    if (additionalChats.length > 0) {
      const additionalChatIds = additionalChats.map((c) => c.id);
      const additionalMessages = await db
        .select()
        .from(message)
        .where(inArray(message.chatId, additionalChatIds));
      allMessages.push(...additionalMessages);
    }
  }

  // Merge results, prioritizing title matches
  const allChats = [...chats, ...additionalChats];

  // Build results with tags and folders
  const results: SearchResult[] = [];

  for (const chatRecord of allChats.slice(0, limit)) {
    // Get tags for this chat
    const tags = await db
      .select({
        id: chatTag.id,
        name: chatTag.name,
        color: chatTag.color,
      })
      .from(chatTag)
      .innerJoin(chatToTag, eq(chatToTag.tagId, chatTag.id))
      .where(eq(chatToTag.chatId, chatRecord.id));

    // Get folders for this chat
    const folders = await db
      .select({
        id: chatFolder.id,
        name: chatFolder.name,
        color: chatFolder.color,
      })
      .from(chatFolder)
      .innerJoin(chatToFolder, eq(chatToFolder.folderId, chatFolder.id))
      .where(eq(chatToFolder.chatId, chatRecord.id));

    // Get messages for this chat
    const chatMessages = allMessages.filter((m) => m.chatId === chatRecord.id);

    // Count matching messages and generate snippet
    const matchingMessages = chatMessages.filter((msg) => {
      const parts = msg.parts as any;
      if (Array.isArray(parts)) {
        return parts.some((part) =>
          part.text && part.text.toLowerCase().includes(query.toLowerCase())
        );
      }
      return false;
    });

    const snippet = matchingMessages[0]?.parts?.[0]?.text?.slice(0, 150);

    results.push({
      id: chatRecord.id,
      title: chatRecord.title,
      createdAt: chatRecord.createdAt,
      updatedAt: chatRecord.updatedAt,
      visibility: chatRecord.visibility,
      snippet: snippet ? `${snippet}${snippet.length >= 150 ? "..." : ""}` : undefined,
      matchedMessages: matchingMessages.length,
      tags,
      folders,
    });
  }

  return results;
}

/**
 * Get search suggestions based on partial query
 */
export async function getSearchSuggestions(
  userId: string,
  partialQuery: string,
  limit = 5
): Promise<string[]> {
  if (!partialQuery || partialQuery.length < 2) {
    return [];
  }

  const db = await getDb();
  const chats = await db
    .select({
      title: chat.title,
    })
    .from(chat)
    .where(and(
      eq(chat.userId, userId),
      like(chat.title, `%${partialQuery}%`)
    ))
    .limit(limit);

  return chats.map((c) => c.title);
}

/**
 * Get recent chats (for search history)
 */
export async function getRecentChats(userId: string, limit = 10) {
  const db = await getDb();
  const recentChats = await db
    .select({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      visibility: chat.visibility,
    })
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(desc(chat.createdAt))
    .limit(limit);

  return recentChats;
}
