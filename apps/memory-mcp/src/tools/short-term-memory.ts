import { z } from 'zod';
import type { D1Storage } from '../storage/d1.js';
import type { ShortTermMemoryListItem } from '../types.js';

// Set operation
export const setShortTermMemorySchema = z.object({
  session_id: z.string(),
  key: z.string(),
  value: z.string(),
  ttl_seconds: z.number().optional(),
});

export type SetShortTermMemoryInput = z.infer<typeof setShortTermMemorySchema>;

/**
 * Set a short-term memory item with optional TTL (default 24 hours)
 */
export async function setShortTermMemory(
  input: SetShortTermMemoryInput,
  d1Storage: D1Storage,
  userId: string
) {
  const { session_id, key, value, ttl_seconds = 86400 } = input;

  const result = await d1Storage.setShortTermMemory(session_id, userId, key, value, ttl_seconds);

  return {
    id: result.id,
    session_id: result.session_id,
    key: result.key,
    expires_at: result.expires_at,
  };
}

// Get operation
export const getShortTermMemorySchema = z.object({
  session_id: z.string(),
  key: z.string(),
});

export type GetShortTermMemoryInput = z.infer<typeof getShortTermMemorySchema>;

/**
 * Get a short-term memory item
 */
export async function getShortTermMemory(input: GetShortTermMemoryInput, d1Storage: D1Storage) {
  const { session_id, key } = input;

  const result = await d1Storage.getShortTermMemory(session_id, key);

  if (!result) {
    return null;
  }

  return {
    value: result.value,
    expires_at: result.expires_at,
  };
}

// List operation
export const listShortTermMemorySchema = z.object({
  session_id: z.string(),
});

export type ListShortTermMemoryInput = z.infer<typeof listShortTermMemorySchema>;

/**
 * List all short-term memory items for a session
 */
export async function listShortTermMemory(input: ListShortTermMemoryInput, d1Storage: D1Storage) {
  const { session_id } = input;

  const results = await d1Storage.listShortTermMemory(session_id);

  const items: ShortTermMemoryListItem[] = results.map((item) => ({
    key: item.key,
    value: item.value,
    expires_at: item.expires_at,
    created_at: item.created_at,
  }));

  return { items };
}

// Delete operation
export const deleteShortTermMemorySchema = z.object({
  session_id: z.string(),
  key: z.string(),
});

export type DeleteShortTermMemoryInput = z.infer<typeof deleteShortTermMemorySchema>;

/**
 * Delete a short-term memory item
 */
export async function deleteShortTermMemory(
  input: DeleteShortTermMemoryInput,
  d1Storage: D1Storage
) {
  const { session_id, key } = input;

  const success = await d1Storage.deleteShortTermMemory(session_id, key);

  return { success };
}
