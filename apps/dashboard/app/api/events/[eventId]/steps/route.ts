import { NextRequest, NextResponse } from 'next/server';
import { getDBFromContext } from '@/lib/db';
import { handleRouteError, listResponse } from '../../../types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const db = await getDBFromContext();
    const { eventId } = await params;
    const steps = await db.steps.getByEvent(eventId);

    return NextResponse.json(listResponse(steps, steps.length));
  } catch (error) {
    return handleRouteError(error);
  }
}
