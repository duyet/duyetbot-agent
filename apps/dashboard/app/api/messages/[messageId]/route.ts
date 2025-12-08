import { NextRequest, NextResponse } from 'next/server';
import { type Env, getDB } from '@/lib/db';
import { handleRouteError, successResponse } from '../../types';

export async function GET(request: NextRequest, { params }: { params: { messageId: string } }) {
  try {
    const env = (request as any).cf?.env as Env;
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const db = getDB(env);
    const message = await db.messages.getMessageById(params.messageId);

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json(successResponse(message));
  } catch (error) {
    return handleRouteError(error);
  }
}
