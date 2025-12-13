import { z } from 'zod';
import type { D1Storage } from '../storage/d1.js';

const categoryEnum = z.enum(['fact', 'preference', 'pattern', 'decision', 'note']);

// Save operation
export const saveLongTermMemorySchema = z.object({
  category: categoryEnum,
  key: z.string(),
  value: z.string(),
  importance: z.number().min(1).max(10).optional(),
  source_session_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SaveLongTermMemoryInput = z.infer<typeof saveLongTermMemorySchema>;

/**
 * Save a long-term memory item (creates or updates)
 */
export async function saveLongTermMemory(
  input: SaveLongTermMemoryInput,
  d1Storage: D1Storage,
  userId: string
) {
  const { category, key, value, importance, source_session_id, metadata } = input;

  const result = await d1Storage.saveLongTermMemory(userId, category, key, value, {
    ...(importance !== undefined && { importance }),
    ...(source_session_id !== undefined && { sourceSessionId: source_session_id }),
    ...(metadata !== undefined && { metadata }),
  });

  // Index for semantic search
  await d1Storage.indexMemoryForSearch(result.id, userId, value, category);

  return {
    id: result.id,
    category: result.category,
    key: result.key,
    created: result.created_at === result.updated_at,
  };
}

// Get operation (list)
export const getLongTermMemorySchema = z.object({
  category: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export type GetLongTermMemoryInput = z.infer<typeof getLongTermMemorySchema>;

/**
 * Get/list long-term memory items
 */
export async function getLongTermMemory(
  input: GetLongTermMemoryInput,
  d1Storage: D1Storage,
  userId: string
) {
  const { category, limit, offset } = input;

  const { items, total } = await d1Storage.listLongTermMemory(userId, {
    ...(category !== undefined && { category }),
    limit: limit || 50,
    offset: offset || 0,
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      category: item.category,
      key: item.key,
      value: item.value,
      importance: item.importance,
      metadata: item.metadata,
      created_at: item.created_at,
      updated_at: item.updated_at,
      access_count: item.access_count,
    })),
    total,
  };
}

// Update operation
export const updateLongTermMemorySchema = z.object({
  id: z.string(),
  value: z.string().optional(),
  importance: z.number().min(1).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateLongTermMemoryInput = z.infer<typeof updateLongTermMemorySchema>;

/**
 * Update a long-term memory item
 */
export async function updateLongTermMemory(input: UpdateLongTermMemoryInput, d1Storage: D1Storage) {
  const { id, value, importance, metadata } = input;

  const success = await d1Storage.updateLongTermMemory(id, {
    ...(value !== undefined && { value }),
    ...(importance !== undefined && { importance }),
    ...(metadata !== undefined && { metadata }),
  });

  return {
    success,
    updated_at: Date.now(),
  };
}

// Delete operation
export const deleteLongTermMemorySchema = z.object({
  id: z.string(),
});

export type DeleteLongTermMemoryInput = z.infer<typeof deleteLongTermMemorySchema>;

/**
 * Delete a long-term memory item
 */
export async function deleteLongTermMemory(input: DeleteLongTermMemoryInput, d1Storage: D1Storage) {
  const { id } = input;

  const success = await d1Storage.deleteLongTermMemory(id);

  return { success };
}
