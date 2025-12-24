import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ sessions: [] });
  }

  try {
    const { env } = await (globalThis as any).getCloudflareContext();
    const db = env.DB as D1Database;

    const result = (
      await db
        .prepare(`
        SELECT 
          s.id,
          s.user_id,
          s.title,
          s.created_at,
          s.updated_at,
          COUNT(m.id) as message_count
        FROM sessions s
        LEFT JOIN messages m ON s.id = m.session_id
        WHERE s.user_id = ?
        GROUP BY s.id
        ORDER BY s.updated_at DESC
        LIMIT 50
      `)
        .bind(userId)
        .all()
    ).results;

    return NextResponse.json({ sessions: result });
  } catch (error) {
    console.error('[Sessions API] Error:', error);
    return NextResponse.json({ sessions: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { env } = await (globalThis as any).getCloudflareContext();
    const db = env.DB as D1Database;

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionData = JSON.parse(sessionCookie);
    const userId = sessionData.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = (await request.json()) as {
      messages: Array<{ content: string; role: string; createdAt?: number }>;
    };

    if (!body || !body.messages || body.messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }

    const sessionId = crypto.randomUUID();
    const title = body.messages[0]?.content?.slice(0, 50) || 'New Chat';
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`
      )
      .bind(sessionId, userId, title, now, now)
      .run();

    for (const msg of body.messages) {
      await db
        .prepare(
          `INSERT INTO messages (id, session_id, content, role, created_at) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), sessionId, msg.content, msg.role, msg.createdAt || now)
        .run();
    }

    return NextResponse.json({ sessionId, title, chatId: sessionId });
  } catch (error) {
    console.error('[Sessions API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = await (globalThis as any).getCloudflareContext();
    const db = env.DB as D1Database;
    const id = await params;

    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    await db.prepare('DELETE FROM messages WHERE session_id = ?').bind(id).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Sessions API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const maxDuration = 60;
