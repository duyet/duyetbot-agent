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
    const eventId = searchParams.get('eventId');

    const db = getDB(env);

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId parameter required' },
        { status: 400 }
      );
    }

    // TODO: Implement event retrieval
    const events: any[] = [];

    return NextResponse.json(listResponse(events, events.length, page, limit));
  } catch (error) {
    return handleRouteError(error);
  }
}
