import { NextRequest, NextResponse } from 'next/server';
import { getDB, type Env } from '@/lib/db';
import { listResponse, handleRouteError, getPaginationParams } from '../types';

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
    const userId = searchParams.get('userId');

    const db = getDB(env);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter required' },
        { status: 400 }
      );
    }

    const sessions = await db.conversations.getUserConversations(userId, limit, offset);
    
    return NextResponse.json(listResponse(sessions, sessions.length, page, limit));
  } catch (error) {
    return handleRouteError(error);
  }
}
