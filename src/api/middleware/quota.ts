/**
 * Quota Enforcement Middleware
 *
 * Enforces resource quotas on API endpoints
 */

import type { Context, Next } from "hono";
import { QuotaExceededError, createQuotaManager } from "@/storage/quota";
import { createSessionRepository } from "@/api/repositories/session";
import { createMessageStore } from "@/storage/kv-message-store";

/**
 * Quota enforcement middleware
 */
export function quotaMiddleware() {
  return async (c: Context, next: Next) => {
    try {
      // Get user ID from auth context
      const userId = c.get("userId") as string | undefined;
      if (!userId) {
        // If no auth, skip quota check (let auth middleware handle it)
        return next();
      }

      // Get D1 and KV bindings from context
      const db = c.env.DB;
      const kv = c.env.KV;

      if (!db || !kv) {
        console.warn("Quota middleware: DB or KV not available");
        return next();
      }

      // Create repositories and stores
      const sessionRepo = createSessionRepository(db);
      const messageStore = createMessageStore(kv);
      const quotaManager = createQuotaManager(sessionRepo, messageStore);

      // Check quota based on request type
      const path = c.req.path;
      const method = c.req.method;

      // Session creation quota
      if (path.includes("/sessions") && method === "POST") {
        await quotaManager.checkCanCreateSession(userId);
      }

      // Message append quota (for session updates with messages)
      if (path.match(/\/sessions\/[^/]+\/messages/) && method === "POST") {
        const sessionId = extractSessionId(path);
        if (sessionId) {
          await quotaManager.checkCanAddMessage(userId, sessionId);
        }
      }

      // Check for approaching limits and add warning header
      const approaching = await quotaManager.isApproachingLimit(userId, 0.9);
      if (approaching.sessions || approaching.storage) {
        c.header("X-Quota-Warning", "Approaching resource limits");
        if (approaching.sessions) {
          c.header("X-Quota-Sessions-Warning", "true");
        }
        if (approaching.storage) {
          c.header("X-Quota-Storage-Warning", "true");
        }
      }

      // Add usage info to response headers
      const usage = await quotaManager.getUsage(userId);
      c.header("X-Quota-Sessions", `${usage.sessionCount}`);
      c.header("X-Quota-Storage", `${usage.estimatedStorageBytes}`);

      await next();
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return c.json(
          {
            error: "quota_exceeded",
            message: error.message,
            quotaType: error.quotaType,
            current: error.current,
            limit: error.limit,
          },
          429,
        );
      }
      throw error;
    }
  };
}

/**
 * Extract session ID from path
 */
function extractSessionId(path: string): string | null {
  const match = path.match(/\/sessions\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Get quota usage for user (helper for status endpoints)
 */
export async function getQuotaUsage(
  userId: string,
  db: D1Database,
  kv: KVNamespace,
) {
  const sessionRepo = createSessionRepository(db);
  const messageStore = createMessageStore(kv);
  const quotaManager = createQuotaManager(sessionRepo, messageStore);

  const usage = await quotaManager.getUsage(userId);
  const utilization = await quotaManager.getUtilization(userId);

  return {
    usage,
    utilization,
    limits: {
      maxSessions: 1000,
      maxMessagesPerSession: 10000,
      maxStorageBytes: 1024 * 1024 * 1024,
    },
  };
}
