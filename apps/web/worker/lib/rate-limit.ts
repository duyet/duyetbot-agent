export async function checkRateLimit(
  env: any,
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const dayStart = now - DAY_MS;
  const LIMIT = 50;

  const count = (await env.DB.prepare(`
    SELECT COUNT(*) as count FROM executions
    WHERE user_id = ? AND created_at > ?
  `)
    .bind(userId, dayStart)
    .first()) as { count: number } | null;

  const used = count?.count || 0;
  const remaining = Math.max(0, LIMIT - used);

  return { allowed: remaining > 0, remaining };
}
