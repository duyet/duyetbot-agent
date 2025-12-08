import { NextRequest, NextResponse } from 'next/server';
import { type Env, getDB } from '@/lib/db';
import { handleRouteError, successResponse } from '../../../types';

export async function PATCH(request: NextRequest, { params }: { params: { messageId: string } }) {
  try {
    const env = (request as any).cf?.env as Env;
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { visibility } = body;

    if (!['private', 'public', 'unlisted'].includes(visibility)) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }

    const db = getDB(env);
    await db.messages.setVisibility(params.messageId, visibility);

    // Fetch updated message
    const updated = await db.messages.getMessageById(params.messageId);

    if (!updated) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json(successResponse(updated));
  } catch (error) {
    return handleRouteError(error);
  }
}
