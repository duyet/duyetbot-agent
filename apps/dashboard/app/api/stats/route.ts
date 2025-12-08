import { NextRequest, NextResponse } from 'next/server';
import { type Env, getDB } from '@/lib/db';
import { handleRouteError, successResponse } from '../types';

/**
 * GET /api/stats
 * Returns global dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    const env = (request as any).cf?.env as Env;
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const db = getDB(env);
    const stats = await db.messages.getGlobalStats();

    return NextResponse.json(successResponse(stats));
  } catch (error) {
    return handleRouteError(error);
  }
}
