import { NextRequest, NextResponse } from 'next/server';
import { getDB, type Env } from '@/lib/db';
import { listResponse, handleRouteError, getDateRangeParams } from '../../types';

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
    const { from, to } = getDateRangeParams(searchParams);
    const type = searchParams.get('type');

    const db = getDB(env);

    if (!from || !to) {
      return NextResponse.json(
        { error: 'from and to date parameters required' },
        { status: 400 }
      );
    }

    const aggregates = await db.aggregates.getDailyRange(from, to, type || undefined);

    return NextResponse.json(listResponse(aggregates, aggregates.length));
  } catch (error) {
    return handleRouteError(error);
  }
}
