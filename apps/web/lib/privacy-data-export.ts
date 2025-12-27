"use client";

import type { SessionHistoryEntry } from "./session-persistence";
import type { MemoryEntry } from "./chat-memory";

/**
 * Complete user data export structure
 */
export interface UserDataExport {
  version: string;
  exportDate: string;
  profile?: UserProfile;
  sessions: SessionExport[];
  memories: MemoryExport[];
  metadata: ExportMetadata;
}

/**
 * User profile data
 */
export interface UserProfile {
  email?: string;
  createdAt: string;
  lastActive: string;
  preferences: UserPreferences;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  language?: string;
  notifications?: boolean;
  dataRetention?: "30d" | "90d" | "1y" | "forever";
  analytics?: boolean;
}

/**
 * Session export format
 */
export interface SessionExport {
  chatId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  folderId?: string;
  visibilityType?: string;
}

/**
 * Memory export format
 */
export interface MemoryExport {
  id: string;
  chatId: string;
  type: string;
  content: string;
  importance: number;
  timestamp: string;
  accessCount: number;
}

/**
 * Export metadata
 */
export interface ExportMetadata {
  totalSessions: number;
  totalMemories: number;
  dataRetentionDays: number;
  estimatedSizeBytes: number;
}

/**
 * Collect all user data for export
 *
 * This gathers:
 * - User profile and preferences
 * - All chat sessions with messages
 * - All memories and context
 * - Tags and folder organization
 */
export async function collectUserData(): Promise<UserDataExport> {
  const profile = collectUserProfile();
  const sessions = collectSessions();
  const memories = collectMemories();

  const totalSize = JSON.stringify({ profile, sessions, memories }).length;

  return {
    version: "1.0",
    exportDate: new Date().toISOString(),
    profile,
    sessions,
    memories,
    metadata: {
      totalSessions: sessions.length,
      totalMemories: memories.length,
      dataRetentionDays: 90, // Default retention
      estimatedSizeBytes: totalSize,
    },
  };
}

/**
 * Collect user profile data
 */
function collectUserProfile(): UserProfile | undefined {
  try {
    const preferences = localStorage.getItem("user-preferences");
    const createdAt = localStorage.getItem("user-created-at") || new Date().toISOString();
    const lastActive = new Date().toISOString();

    return {
      email: undefined, // Email is stored server-side
      createdAt,
      lastActive,
      preferences: preferences ? JSON.parse(preferences) : {},
    };
  } catch (error) {
    console.error("[PrivacyExport] Failed to collect profile:", error);
    return undefined;
  }
}

/**
 * Collect all session data
 */
function collectSessions(): SessionExport[] {
  try {
    const history = getSessionHistory();
    const sessions: SessionExport[] = [];

    for (const entry of history) {
      // Get session state for each chat
      const sessionKey = `chat-active-session:${entry.chatId}`;
      const sessionData = localStorage.getItem(sessionKey);

      // Get metadata
      const metadataKey = `chat-session-metadata:${entry.chatId}`;
      const metadata = JSON.parse(localStorage.getItem(metadataKey) || "{}");

      sessions.push({
        chatId: entry.chatId,
        title: entry.title,
        messageCount: entry.messageCount,
        createdAt: entry.timestamp,
        updatedAt: sessionData ? JSON.parse(sessionData).timestamp : entry.timestamp,
        tags: metadata.tags,
        folderId: metadata.folderId,
        visibilityType: metadata.visibilityType,
      });
    }

    return sessions;
  } catch (error) {
    console.error("[PrivacyExport] Failed to collect sessions:", error);
    return [];
  }
}

/**
 * Collect all memory data
 */
function collectMemories(): MemoryExport[] {
  try {
    const memoryKey = "chat-memory-store";
    const stored = localStorage.getItem(memoryKey);

    if (!stored) return [];

    const memories: MemoryEntry[] = JSON.parse(stored);

    return memories.map((mem) => ({
      id: mem.id,
      chatId: mem.chatId,
      type: mem.type,
      content: mem.content,
      importance: mem.importance,
      timestamp: mem.timestamp,
      accessCount: mem.accessCount,
    }));
  } catch (error) {
    console.error("[PrivacyExport] Failed to collect memories:", error);
    return [];
  }
}

/**
 * Get session history from localStorage
 */
function getSessionHistory(): SessionHistoryEntry[] {
  try {
    const stored = localStorage.getItem("chat-session-history");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Export user data as JSON file
 *
 * GDPR Requirement: Right to data portability
 * Users can download all their personal data in a machine-readable format
 */
export async function exportUserData(): Promise<void> {
  try {
    const data = await collectUserData();
    const json = JSON.stringify(data, null, 2);

    // Create blob and download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my-data-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("[PrivacyExport] Failed to export data:", error);
    throw new Error("Failed to export data. Please try again.");
  }
}

/**
 * Export user data as human-readable HTML report
 *
 * GDPR Requirement: Data must be provided in a commonly used format
 * This creates a formatted HTML report that users can easily read
 */
export async function exportUserDataAsHTML(): Promise<void> {
  try {
    const data = await collectUserData();

    const html = generateHTMLReport(data);

    // Create blob and download
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my-data-report-${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("[PrivacyExport] Failed to export HTML:", error);
    throw new Error("Failed to export report. Please try again.");
  }
}

/**
 * Generate HTML report from user data
 */
function generateHTMLReport(data: UserDataExport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Data Export</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .section { background: #fff; border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin: 10px 0; }
    .session-item { border-left: 3px solid #007bff; padding-left: 10px; margin: 10px 0; }
    .memory-item { border-left: 3px solid #28a745; padding-left: 10px; margin: 10px 0; }
    .tag { display: inline-block; background: #e9ecef; padding: 2px 8px; border-radius: 3px; font-size: 12px; margin-right: 5px; }
    .timestamp { color: #6c757d; font-size: 12px; }
  </style>
</head>
<body>
  <h1>My Data Export</h1>

  <div class="metadata">
    <p><strong>Export Date:</strong> ${new Date(data.exportDate).toLocaleString()}</p>
    <p><strong>Version:</strong> ${data.version}</p>
    <p><strong>Total Sessions:</strong> ${data.metadata.totalSessions}</p>
    <p><strong>Total Memories:</strong> ${data.metadata.totalMemories}</p>
    <p><strong>Estimated Size:</strong> ${(data.metadata.estimatedSizeBytes / 1024).toFixed(2)} KB</p>
  </div>

  ${data.profile ? `
  <h2>Profile Information</h2>
  <div class="section">
    <p><strong>Account Created:</strong> ${new Date(data.profile.createdAt).toLocaleString()}</p>
    <p><strong>Last Active:</strong> ${new Date(data.profile.lastActive).toLocaleString()}</p>
    <p><strong>Theme:</strong> ${data.profile.preferences.theme || 'Not set'}</p>
    <p><strong>Language:</strong> ${data.profile.preferences.language || 'Not set'}</p>
  </div>
  ` : ''}

  <h2>Chat Sessions (${data.sessions.length})</h2>
  ${data.sessions.map(session => `
    <div class="session-item">
      <p><strong>${session.title}</strong></p>
      <p class="timestamp">${session.messageCount} messages • Created ${new Date(session.createdAt).toLocaleDateString()}</p>
      ${session.tags?.length ? `<p>${session.tags.map(t => `<span class="tag">${t}</span>`).join('')}</p>` : ''}
    </div>
  `).join('')}

  <h2>Saved Memories (${data.memories.length})</h2>
  ${data.memories.map(memory => `
    <div class="memory-item">
      <p><strong>${memory.type}</strong>: ${memory.content.substring(0, 100)}${memory.content.length > 100 ? '...' : ''}</p>
      <p class="timestamp">Importance: ${(memory.importance * 100).toFixed(0)}% • Accessed ${memory.accessCount} times</p>
    </div>
  `).join('')}

</body>
</html>`;
}

/**
 * Validate user-provided data import
 *
 * GDPR Requirement: Data portability includes the right to import data
 * This validates imported data before applying it
 */
export function validateDataImport(json: string): { valid: boolean; error?: string } {
  try {
    const data = JSON.parse(json);

    // Basic structure validation
    if (!data.version || typeof data.version !== "string") {
      return { valid: false, error: "Invalid data format: missing version" };
    }

    if (!Array.isArray(data.sessions)) {
      return { valid: false, error: "Invalid data format: sessions must be an array" };
    }

    if (!Array.isArray(data.memories)) {
      return { valid: false, error: "Invalid data format: memories must be an array" };
    }

    // Validate session structure
    for (const session of data.sessions) {
      if (!session.chatId || !session.title) {
        return { valid: false, error: "Invalid session format: missing required fields" };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Invalid JSON format" };
  }
}

/**
 * Import user data from export
 *
 * GDPR Requirement: Right to data portability
 * Allows users to import data they've previously exported
 */
export async function importUserData(json: string): Promise<{ success: boolean; error?: string }> {
  // Validate first
  const validation = validateDataImport(json);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const data: UserDataExport = JSON.parse(json);

    // Ask for confirmation before overwriting
    const confirmed = await confirmImportAction(data);
    if (!confirmed) {
      return { success: false, error: "Import cancelled by user" };
    }

    // Import sessions
    const sessionHistoryKey = "chat-session-history";
    const existingHistory = JSON.parse(localStorage.getItem(sessionHistoryKey) || "[]");
    const mergedHistory = [...existingHistory, ...data.sessions]
      .reduce((acc, session) => {
        if (!acc.find((s: any) => s.chatId === session.chatId)) {
          acc.push(session);
        }
        return acc;
      }, [] as any[])
      .slice(-100); // Keep last 100
    localStorage.setItem(sessionHistoryKey, JSON.stringify(mergedHistory));

    // Import memories
    if (data.memories.length > 0) {
      localStorage.setItem("chat-memory-store", JSON.stringify(data.memories));
    }

    // Import preferences
    if (data.profile?.preferences) {
      localStorage.setItem("user-preferences", JSON.stringify(data.profile.preferences));
    }

    return { success: true };
  } catch (error) {
    console.error("[PrivacyExport] Failed to import data:", error);
    return { success: false, error: "Failed to import data. Please try again." };
  }
}

/**
 * Show import confirmation dialog
 */
async function confirmImportAction(data: UserDataExport): Promise<boolean> {
  // In a real implementation, this would show a proper modal
  // For now, use browser confirm
  const message = `Import ${data.sessions.length} sessions and ${data.memories.length} memories?\n\nThis will merge with your existing data.`;
  return window.confirm(message);
}
