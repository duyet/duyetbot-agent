/**
 * Service Binding Memory Adapter
 *
 * Uses Cloudflare Service Bindings for fast, non-blocking memory operations.
 * No HTTP overhead - direct RPC calls within the same datacenter.
 */
import { toMemoryMessage } from './memory-adapter.js';
/**
 * Memory adapter using Cloudflare Service Bindings
 *
 * This adapter provides:
 * - Sub-millisecond latency (no network overhead)
 * - Non-blocking operations (no blockConcurrencyWhile issues)
 * - Direct RPC calls to the memory service
 */
export class ServiceBindingMemoryAdapter {
  service;
  userId;
  constructor(config) {
    this.service = config.service;
    this.userId = config.userId;
  }
  /**
   * Get messages for a session
   */
  async getMemory(sessionId, options) {
    try {
      return await this.service.getMemory(this.userId, sessionId, options);
    } catch (err) {
      console.warn('ServiceBinding getMemory failed:', err);
      return { sessionId, messages: [], metadata: {} };
    }
  }
  /**
   * Save messages to a session
   */
  async saveMemory(sessionId, messages, metadata) {
    try {
      const memoryMessages = messages.map(toMemoryMessage);
      return await this.service.saveMemory(this.userId, sessionId, memoryMessages, metadata);
    } catch (err) {
      console.warn('ServiceBinding saveMemory failed:', err);
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }
  }
  /**
   * Search across messages
   */
  async searchMemory(query, options) {
    try {
      return await this.service.searchMemory(this.userId, query, options);
    } catch (err) {
      console.warn('ServiceBinding searchMemory failed:', err);
      return [];
    }
  }
  /**
   * List sessions
   */
  async listSessions(options) {
    try {
      return await this.service.listSessions(this.userId, options);
    } catch (err) {
      console.warn('ServiceBinding listSessions failed:', err);
      return { sessions: [], total: 0 };
    }
  }
}
/**
 * Create a service binding memory adapter
 */
export function createServiceBindingMemoryAdapter(config) {
  return new ServiceBindingMemoryAdapter(config);
}
