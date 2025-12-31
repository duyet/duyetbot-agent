import { NextRequest, NextResponse } from 'next/server';
import { getDBFromContext } from '@/lib/db';
import { getPaginationParams, handleRouteError, listResponse } from '../types';

export async function GET(request: NextRequest) {
  try {
    const db = await getDBFromContext();
    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = getPaginationParams(searchParams);
    const eventId = searchParams.get('eventId');

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
