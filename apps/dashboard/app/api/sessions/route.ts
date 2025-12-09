import { NextRequest, NextResponse } from 'next/server';
import { getDBFromContext } from '@/lib/db';
import { getPaginationParams, handleRouteError, listResponse } from '../types';

export async function GET(request: NextRequest) {
  try {
    const db = await getDBFromContext();
    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = getPaginationParams(searchParams);
    const userId = searchParams.get('userId');

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
