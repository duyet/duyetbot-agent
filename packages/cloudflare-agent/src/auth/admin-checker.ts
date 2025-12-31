/**
 * Configuration for the admin checker
 */
export interface AdminConfig {
  /** Set of user IDs authorized as admins */
  adminUserIds?: Set<string | number>;
  /** Set of usernames authorized as admins (less secure, but supported for legacy) */
  adminUsernames?: Set<string>;
}

/**
 * Check if a user is an authorized admin
 *
 * @param userId - The unique user ID from the platform
 * @param username - The username (optional)
 * @param config - The admin configuration
 * @returns true if the user is authorized, false otherwise
 */
export function isAdminUser(
  userId: string | number | undefined,
  username: string | undefined,
  config: AdminConfig
): boolean {
  if (!config) {
    return false;
  }

  // Check user ID if provided
  if (userId !== undefined && config.adminUserIds) {
    const userIdStr = String(userId);
    // Check for string match
    if (config.adminUserIds.has(userIdStr)) {
      return true;
    }
    // Check for number match if available in Set
    if (typeof userId === 'number' && config.adminUserIds.has(userId)) {
      return true;
    }
  }

  // Check username if provided (fallback)
  if (username !== undefined && config.adminUsernames) {
    if (config.adminUsernames.has(username)) {
      return true;
    }
  }

  return false;
}
