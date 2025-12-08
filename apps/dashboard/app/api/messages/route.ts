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
    const { page, limit, offset } = getPaginationParams(searchParams);

    const db = getDB(env);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    if (sessionId) {
      const messages = await db.messages.getMessagesBySession(sessionId, { limit, offset });
      return NextResponse.json(listResponse(messages, messages.length, page, limit));
    }

    if (userId) {
      // getMessagesByUser returns PaginatedResult
      const result = await db.messages.getMessagesByUser(userId, { limit, offset });
      return NextResponse.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.pageSize,
          total: result.total,
          hasMore: result.hasMore,
        },
      });
    }

    const messages = await db.messages.getRecentMessages(limit);
    return NextResponse.json(listResponse(messages, messages.length, page, limit));
  } catch (error) {
    return handleRouteError(error);
  }
}
