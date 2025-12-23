/**
 * Logout Endpoint
 *
 * Clears the session cookie to log out the user
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '../../../../lib/auth';

export async function POST(_request: NextRequest) {
  try {
    const _cookieStore = await cookies();
    const response = NextResponse.json({ success: true });

    // Clear session cookie
    response.cookies.delete(SESSION_COOKIE_NAME);

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  // Also support GET for simpler client-side usage
  return POST(_request);
}
