import { NextRequest, NextResponse } from 'next/server';
import { type Env, getDB } from '@/lib/db';
import { getPaginationParams, handleRouteError, listResponse } from '../types';

export async function GET(request: NextRequest) {
  try {
    const env = (request as any).cf?.env as Env;
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = getPaginationParams(searchParams);
    const userId = searchParams.get('userId');

    const db = getDB(env);

    // If userId is provided, filter by user
    if (userId) {
      const sessions = await db.conversations.getConversationsByUser(userId);
      return NextResponse.json(listResponse(sessions, sessions.length, page, limit));
    }

    // Otherwise, return recent conversations across all users
    const sessions = await db.conversations.getRecentConversations(limit);
    return NextResponse.json(listResponse(sessions, sessions.length, page, limit));
  } catch (error) {
    return handleRouteError(error);
  }
}
