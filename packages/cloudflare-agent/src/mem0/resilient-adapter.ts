/**
 * Resilient Mem0 Memory Adapter with graceful degradation
 *
 * This adapter wraps Mem0MemoryAdapter and provides:
 * - Health checking with timeout
 * - Availability caching (60s interval)
 * - Silent failure mode (returns empty data instead of throwing)
 * - Fire-and-forget writes
 */

import type {
  LongTermMemoryEntry,
  MemoryAdapter,
  MemoryData,
  MemorySearchResult,
  SaveLongTermMemoryResult,
  SaveMemoryResult,
  SaveShortTermMemoryResult,
  SessionInfo,
  ShortTermMemoryEntry,
} from '../memory-adapter.js';
import type { Message } from '../types.js';
import { Mem0MemoryAdapter } from './adapter.js';
import type { Mem0Config } from './types.js';

/**
 * Resilient Mem0 Memory Adapter implementation
 */
export class ResilientMem0MemoryAdapter implements MemoryAdapter {
  private adapter: Mem0MemoryAdapter;
  private baseURL: string;
  private apiKey: string;
  private isAvailable = true;
  private lastCheck = 0;
  private checkInterval = 60000; // 1 minute
  private initTimeout: number;

  constructor(config: Mem0Config & { initTimeout?: number }) {
    this.adapter = new Mem0MemoryAdapter(config);
    this.baseURL = config.baseURL?.replace(/\/$/, '') || 'https://api.mem0.ai';
    this.apiKey = config.apiKey;
    this.initTimeout = config.initTimeout ?? 2000; // 2s default for fast init
  }

  /**
   * Check if Mem0 API is available (with caching)
   */
  private async checkAvailability(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastCheck < this.checkInterval) {
      return this.isAvailable;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.initTimeout);

      // Try a simple request to check availability
      const response = await fetch(`${this.baseURL}/v1/memories/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${this.apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      this.isAvailable = response.ok || response.status === 401; // 401 means server is up but needs auth
    } catch {
      this.isAvailable = false;
    }

    this.lastCheck = now;
    return this.isAvailable;
  }

  async getMemory(
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    if (!(await this.checkAvailability())) {
      return { sessionId, messages: [], metadata: {} };
    }

    try {
      return await this.adapter.getMemory(sessionId, options);
    } catch (err) {
      console.warn('Mem0 getMemory failed:', err);
      return { sessionId, messages: [], metadata: {} };
    }
  }

  async saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult> {
    if (!(await this.checkAvailability())) {
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }

    try {
      return await this.adapter.saveMemory(sessionId, messages, metadata);
    } catch (err) {
      console.warn('Mem0 saveMemory failed:', err);
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }
  }

  async searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]> {
    if (!(await this.checkAvailability())) {
      return [];
    }

    try {
      return await this.adapter.searchMemory(query, options);
    } catch (err) {
      console.warn('Mem0 searchMemory failed:', err);
      return [];
    }
  }

  async listSessions(): Promise<{ sessions: SessionInfo[]; total: number }> {
    if (!(await this.checkAvailability())) {
      return { sessions: [], total: 0 };
    }

    try {
      return await this.adapter.listSessions();
    } catch (err) {
      console.warn('Mem0 listSessions failed:', err);
      return { sessions: [], total: 0 };
    }
  }

  async saveShortTermMemory(
    sessionId: string,
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<SaveShortTermMemoryResult> {
    if (!(await this.checkAvailability())) {
      return {
        key,
        expiresAt: Date.now() + (ttlSeconds || 86400) * 1000,
        success: false,
      };
    }

    try {
      return await this.adapter.saveShortTermMemory(sessionId, key, value, ttlSeconds);
    } catch (err) {
      console.warn('Mem0 saveShortTermMemory failed:', err);
      return {
        key,
        expiresAt: Date.now() + (ttlSeconds || 86400) * 1000,
        success: false,
      };
    }
  }

  async getShortTermMemory(sessionId: string, key: string): Promise<ShortTermMemoryEntry | null> {
    if (!(await this.checkAvailability())) {
      return null;
    }

    try {
      return await this.adapter.getShortTermMemory(sessionId, key);
    } catch (err) {
      console.warn('Mem0 getShortTermMemory failed:', err);
      return null;
    }
  }

  async listShortTermMemory(sessionId: string): Promise<ShortTermMemoryEntry[]> {
    if (!(await this.checkAvailability())) {
      return [];
    }

    try {
      return await this.adapter.listShortTermMemory(sessionId);
    } catch (err) {
      console.warn('Mem0 listShortTermMemory failed:', err);
      return [];
    }
  }

  async deleteShortTermMemory(sessionId: string, key: string): Promise<boolean> {
    if (!(await this.checkAvailability())) {
      return false;
    }

    try {
      return await this.adapter.deleteShortTermMemory(sessionId, key);
    } catch (err) {
      console.warn('Mem0 deleteShortTermMemory failed:', err);
      return false;
    }
  }

  async saveLongTermMemory(
    category: 'fact' | 'preference' | 'pattern' | 'decision' | 'note',
    key: string,
    value: string,
    importance?: number,
    metadata?: Record<string, unknown>
  ): Promise<SaveLongTermMemoryResult> {
    if (!(await this.checkAvailability())) {
      return {
        id: `local-${Date.now()}`,
        created: false,
        success: false,
      };
    }

    try {
      return await this.adapter.saveLongTermMemory(category, key, value, importance, metadata);
    } catch (err) {
      console.warn('Mem0 saveLongTermMemory failed:', err);
      return {
        id: `local-${Date.now()}`,
        created: false,
        success: false,
      };
    }
  }

  async getLongTermMemory(filters?: {
    category?: 'fact' | 'preference' | 'pattern' | 'decision' | 'note';
    key?: string;
    limit?: number;
  }): Promise<LongTermMemoryEntry[]> {
    if (!(await this.checkAvailability())) {
      return [];
    }

    try {
      return await this.adapter.getLongTermMemory(filters);
    } catch (err) {
      console.warn('Mem0 getLongTermMemory failed:', err);
      return [];
    }
  }

  async updateLongTermMemory(
    id: string,
    updates: {
      value?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    if (!(await this.checkAvailability())) {
      return false;
    }

    try {
      return await this.adapter.updateLongTermMemory(id, updates);
    } catch (err) {
      console.warn('Mem0 updateLongTermMemory failed:', err);
      return false;
    }
  }

  async deleteLongTermMemory(id: string): Promise<boolean> {
    if (!(await this.checkAvailability())) {
      return false;
    }

    try {
      return await this.adapter.deleteLongTermMemory(id);
    } catch (err) {
      console.warn('Mem0 deleteLongTermMemory failed:', err);
      return false;
    }
  }

  async searchMemoryByQuery(
    query: string,
    filters?: {
      categories?: string[];
      limit?: number;
    }
  ): Promise<Array<{ id: string; content: string; category: string; score: number }>> {
    if (!(await this.checkAvailability())) {
      return [];
    }

    try {
      return await this.adapter.searchMemoryByQuery(query, filters);
    } catch (err) {
      console.warn('Mem0 searchMemoryByQuery failed:', err);
      return [];
    }
  }
}

/**
 * Create a resilient Mem0 memory adapter with graceful degradation
 */
export function createResilientMem0MemoryAdapter(
  config: Mem0Config & { initTimeout?: number }
): ResilientMem0MemoryAdapter {
  return new ResilientMem0MemoryAdapter(config);
}
