import { NextRequest, NextResponse } from 'next/server';
import { type Env, getDB } from '@/lib/db';
import { handleRouteError, successResponse } from '../../types';

export async function GET(request: NextRequest) {
  try {
    const env = (request as any).cf?.env as Env;
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    const db = getDB(env);

    // If userId provided, return user-specific stats
    if (userId) {
      const userStats = await db.messages.getUserStats(userId);

      if (!userStats) {
        return NextResponse.json(
          successResponse({
            userId,
            messageCount: 0,
            sessionCount: 0,
            totalTokens: 0,
            estimatedCostUsd: 0,
          })
        );
      }

      return NextResponse.json(successResponse(userStats));
    }

    // Otherwise return global token summary
    const globalStats = await db.messages.getGlobalStats();
    return NextResponse.json(
      successResponse({
        messageCount: globalStats.totalMessages,
        sessionCount: globalStats.totalSessions,
        userCount: globalStats.totalUsers,
        totalInputTokens: globalStats.totalInputTokens,
        totalOutputTokens: globalStats.totalOutputTokens,
        totalTokens: globalStats.totalTokens,
        platformBreakdown: globalStats.platformBreakdown,
        estimatedCostUsd: 0, // TODO: Calculate from cost config
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
