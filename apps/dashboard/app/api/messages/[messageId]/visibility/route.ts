import { NextRequest, NextResponse } from 'next/server';
import { getDBFromContext } from '@/lib/db';
import { handleRouteError, successResponse } from '../../../types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const db = await getDBFromContext();
    const { messageId } = await params;
    const body = (await request.json()) as { visibility: string };
    const { visibility } = body;

    if (!['private', 'public', 'unlisted'].includes(visibility)) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }

    await db.messages.setVisibility(messageId, visibility as 'private' | 'public' | 'unlisted');

    // Fetch updated message
    const updated = await db.messages.getMessageById(messageId);

    if (!updated) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json(successResponse(updated));
  } catch (error) {
    return handleRouteError(error);
  }
}
