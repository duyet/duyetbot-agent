import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Health check endpoint for load balancers and monitoring systems.
 * Returns service health status without database queries.
 *
 * @returns JSON response with status and timestamp
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    }
  );
}
