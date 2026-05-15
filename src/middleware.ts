import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/signin',
  },
});

export const config = {
  matcher: [
    '/feature-development/:path*',
    '/dashboard/:path*',
    '/chat/:path*',
    '/settings/:path*',
    '/skills/new',
  ],
};
