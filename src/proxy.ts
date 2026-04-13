import { default as authMiddleware } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 Proxy layer.
 * Replaces the deprecated middleware.ts convention.
 * Runs on the Node.js runtime.
 */
export default async function proxy(request: NextRequest, event: any) {
  const { pathname } = request.nextUrl;

  // CRITICAL: Bypass the proxy for ALL /api/auth routes.
  // This prevents the proxy from intercepting NextAuth handlers and session calls.
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Apply authentication middleware for matched routes
  return (authMiddleware as any)(request, event);
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/dashboard/:path*',
    '/skills/:path*',
    '/settings/:path*',
  ],
};
