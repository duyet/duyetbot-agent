import type { AggregateType } from '@duyetbot/analytics';
import { NextRequest, NextResponse } from 'next/server';
import { type Env, getDB } from '@/lib/db';
import { getDateRangeParams, handleRouteError, listResponse } from '../../types';

export async function GET(request: NextRequest) {
  try {
    const env = (request as any).cf?.env as Env;
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const { from, to } = getDateRangeParams(searchParams);
    const type = searchParams.get('type') as AggregateType | null;

    const db = getDB(env);

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to date parameters required' }, { status: 400 });
    }

    // Parse ISO date strings to timestamps
    const fromTs = new Date(from).getTime();
    const toTs = new Date(to).getTime();

    const aggregates = await db.aggregates.getDailyRange(fromTs, toTs, type || undefined);

    return NextResponse.json(listResponse(aggregates, aggregates.length));
  } catch (error) {
    return handleRouteError(error);
  }
}
