import { NextRequest, NextResponse } from 'next/server';
import { getDB, type Env } from '@/lib/db';
import { successResponse, handleRouteError } from '../../types';

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
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter required' },
        { status: 400 }
      );
    }

    const db = getDB(env);
    const tokenUsage = await db.messages.getUserTokenUsage(userId);

    const totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens + tokenUsage.cachedTokens + tokenUsage.reasoningTokens;

    return NextResponse.json(successResponse({
      ...tokenUsage,
      totalTokens,
      estimatedCostUsd: 0, // TODO: Calculate based on cost config
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
