import { NextRequest, NextResponse } from 'next/server';
import { getDBFromContext } from '@/lib/db';
import { handleRouteError, successResponse } from '../../types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const db = await getDBFromContext();
    const { sessionId } = await params;
    const session = await db.conversations.getConversationById(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(successResponse(session));
  } catch (error) {
    return handleRouteError(error);
  }
}
