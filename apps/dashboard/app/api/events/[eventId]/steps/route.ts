import { NextRequest, NextResponse } from 'next/server';
import { type Env, getDB } from '@/lib/db';
import { handleRouteError, listResponse } from '../../../types';

export async function GET(request: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    const env = (request as any).cf?.env as Env;
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const db = getDB(env);
    const steps = await db.steps.getByEvent(params.eventId);

    return NextResponse.json(listResponse(steps, steps.length));
  } catch (error) {
    return handleRouteError(error);
  }
}
