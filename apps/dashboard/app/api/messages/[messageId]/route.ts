import { NextRequest, NextResponse } from 'next/server';
import { getDBFromContext } from '@/lib/db';
import { handleRouteError, successResponse } from '../../types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const db = await getDBFromContext();
    const { messageId } = await params;
    const message = await db.messages.getMessageById(messageId);

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json(successResponse(message));
  } catch (error) {
    return handleRouteError(error);
  }
}
