import { NextRequest, NextResponse } from 'next/server';
import { getDB, type Env } from '@/lib/db';
import { getPaginationParams, listResponse, handleRouteError } from '../types';

export async function GET(request: NextRequest) {
  try {
    const env = (request as any).cf?.env as Env;
    if (!env?.DB) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, offset } = getPaginationParams(searchParams);
    
    const db = getDB(env);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    let messages;
    let total;

    if (sessionId) {
      messages = await db.messages.getMessagesBySession(sessionId, { limit, offset });
      total = await db.messages.getSessionMessageCount(sessionId);
    } else if (userId) {
      messages = await db.messages.getMessagesByUser(userId, { limit, offset });
      total = messages.length; // TODO: Add total count method
    } else {
      messages = await db.messages.getRecentMessages(limit);
      total = messages.length;
    }

    return NextResponse.json(listResponse(messages, total, page, limit));
  } catch (error) {
    return handleRouteError(error);
  }
}
