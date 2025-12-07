import { NextRequest, NextResponse } from 'next/server';
import { getDB, type Env } from '@/lib/db';
import { successResponse, handleRouteError, listResponse, getPaginationParams } from '../../types';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const env = (request as any).cf?.env as Env;
    if (!env?.DB) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const db = getDB(env);
    const session = await db.conversations.getById(params.sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(successResponse(session));
  } catch (error) {
    return handleRouteError(error);
  }
}
