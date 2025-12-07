import { NextRequest, NextResponse } from 'next/server';
import { getDB, type Env } from '@/lib/db';
import { successResponse, handleRouteError } from '../../types';

export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } }
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
    const message = await db.messages.getById(params.messageId);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(successResponse(message));
  } catch (error) {
    return handleRouteError(error);
  }
}
