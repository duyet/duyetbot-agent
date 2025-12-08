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
    const eventId = searchParams.get('eventId');

    const db = getDB(env);

    // If eventId is provided, get steps for that event
    if (eventId) {
      const steps = await db.steps.getStepsByEvent(eventId);
      return NextResponse.json(listResponse(steps, steps.length, page, limit));
    }

    // Otherwise, return recent steps across all events
    const steps = await db.steps.getRecentSteps(limit);
    return NextResponse.json(listResponse(steps, steps.length, page, limit));
  } catch (error) {
    return handleRouteError(error);
  }
}
