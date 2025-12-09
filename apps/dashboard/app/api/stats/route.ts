import { NextResponse } from 'next/server';
import { getDBFromContext } from '@/lib/db';
import { handleRouteError, successResponse } from '../types';

/**
 * GET /api/stats
 * Returns global dashboard statistics
 */
export async function GET() {
  try {
    const db = await getDBFromContext();
    const stats = await db.messages.getGlobalStats();
    return NextResponse.json(successResponse(stats));
  } catch (error) {
    return handleRouteError(error);
  }
}
