import { nanoid } from 'nanoid';

export async function getOrCreateGuestUser(c: any, env: any): Promise<any> {
  const guestId = c.req.cookie('guest_id');

  if (guestId) {
    const existing = await env.DB.prepare(`SELECT * FROM users WHERE id = ? AND is_guest = 1`)
      .bind(guestId)
      .first();

    if (existing) {
      return existing;
    }
  }

  const userId = nanoid();
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO users (id, github_id, login, name, avatar_url, is_guest, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `)
    .bind(userId, `guest_${userId}`, `guest_${userId}`, 'Guest', null, now)
    .run();

  c.req.cookie.set('guest_id', userId, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  return { id: userId, is_guest: 1 };
}
