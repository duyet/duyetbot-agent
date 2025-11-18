/**
 * Resource Quota Management
 *
 * Per-user resource limits and enforcement
 */

import type { SessionRepository } from '@/api/repositories/session';
import type { D1Database } from '@cloudflare/workers-types';
import type { MessageStore } from './kv-message-store';

/**
 * Resource quotas per user
 */
export interface ResourceQuota {
  /**
   * Maximum number of sessions per user
   */
  maxSessions: number;

  /**
   * Maximum messages per session
   */
  maxMessagesPerSession: number;

  /**
   * Maximum tool results per session
   */
  maxToolResultsPerSession: number;

  /**
   * Maximum total storage in bytes (approximate)
   */
  maxStorageBytes: number;
}

/**
 * Default quotas for standard users
 */
export const DEFAULT_QUOTA: ResourceQuota = {
  maxSessions: 1000,
  maxMessagesPerSession: 10000,
  maxToolResultsPerSession: 1000,
  maxStorageBytes: 1024 * 1024 * 1024, // 1GB
};

/**
 * Resource usage information
 */
export interface ResourceUsage {
  sessionCount: number;
  messagesInSession: number;
  toolResultsInSession: number;
  estimatedStorageBytes: number;
}

/**
 * Quota error
 */
export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public quotaType: string,
    public current: number,
    public limit: number
  ) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Quota manager for resource enforcement
 */
export class QuotaManager {
  constructor(
    private sessionRepo: SessionRepository,
    private messageStore: MessageStore,
    private quota: ResourceQuota = DEFAULT_QUOTA
  ) {}

  /**
   * Check if user can create a new session
   */
  async checkCanCreateSession(userId: string): Promise<void> {
    const sessionCount = await this.sessionRepo.count(userId);

    if (sessionCount >= this.quota.maxSessions) {
      throw new QuotaExceededError(
        `Session quota exceeded. Maximum ${this.quota.maxSessions} sessions allowed.`,
        'sessions',
        sessionCount,
        this.quota.maxSessions
      );
    }
  }

  /**
   * Check if can add message to session
   */
  async checkCanAddMessage(userId: string, sessionId: string): Promise<void> {
    const messageCount = await this.messageStore.count(userId, sessionId);

    if (messageCount >= this.quota.maxMessagesPerSession) {
      throw new QuotaExceededError(
        `Message quota exceeded for session. Maximum ${this.quota.maxMessagesPerSession} messages allowed.`,
        'messages',
        messageCount,
        this.quota.maxMessagesPerSession
      );
    }
  }

  /**
   * Get current resource usage for user
   */
  async getUsage(userId: string, sessionId?: string): Promise<ResourceUsage> {
    const sessionCount = await this.sessionRepo.count(userId);

    let messagesInSession = 0;
    const toolResultsInSession = 0;

    if (sessionId) {
      messagesInSession = await this.messageStore.count(userId, sessionId);
      // Note: toolResultsInSession would come from ToolResultStore
      // Not implementing here to avoid circular dependency
    }

    // Estimate storage (very rough approximation)
    // Average message ~1KB, average session metadata ~500 bytes
    const estimatedStorageBytes = sessionCount * 500 + messagesInSession * 1024;

    return {
      sessionCount,
      messagesInSession,
      toolResultsInSession,
      estimatedStorageBytes,
    };
  }

  /**
   * Get quota utilization percentage
   */
  async getUtilization(userId: string): Promise<{
    sessions: number;
    storage: number;
  }> {
    const usage = await this.getUsage(userId);

    return {
      sessions: (usage.sessionCount / this.quota.maxSessions) * 100,
      storage: (usage.estimatedStorageBytes / this.quota.maxStorageBytes) * 100,
    };
  }

  /**
   * Check if user is approaching quota limits
   */
  async isApproachingLimit(
    userId: string,
    threshold = 0.9
  ): Promise<{
    sessions: boolean;
    storage: boolean;
  }> {
    const utilization = await this.getUtilization(userId);

    return {
      sessions: utilization.sessions >= threshold * 100,
      storage: utilization.storage >= threshold * 100,
    };
  }
}

/**
 * Create quota manager
 */
export function createQuotaManager(
  sessionRepo: SessionRepository,
  messageStore: MessageStore,
  quota?: Partial<ResourceQuota>
): QuotaManager {
  const finalQuota = {
    ...DEFAULT_QUOTA,
    ...quota,
  };

  return new QuotaManager(sessionRepo, messageStore, finalQuota);
}
