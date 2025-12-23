/**
 * Authentication Middleware
 *
 * Protects routes by requiring authentication.
 * Redirects unauthenticated users to the login page.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAuthenticated } from './lib/session';

/**
 * Routes that require authentication
 */
const PROTECTED_ROUTES = ['/'];

/**
 * Routes that are publicly accessible
 */
const PUBLIC_ROUTES = ['/api/auth/login', '/api/auth/callback'];

/**
 * Middleware to protect routes
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  const isAuthed = await isAuthenticated();

  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!isAuthed) {
      // Redirect to login
      const loginUrl = new URL('/api/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (already handled in middleware)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
  ],
};
