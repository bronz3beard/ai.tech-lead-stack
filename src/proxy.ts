import { default as authMiddleware } from 'next-auth/middleware';

/**
 * Next.js 16 Proxy layer.
 * Replaces the deprecated middleware.ts convention.
 * Runs on the Node.js runtime.
 */
export const proxy = authMiddleware;

export const config = {
  matcher: [
    '/chat/:path*',
    '/dashboard/:path*',
    '/skills/:path*',
    '/settings/:path*',
  ],
};
