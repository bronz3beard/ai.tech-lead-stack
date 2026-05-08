import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
  },
  /**
   * Pins Turbopack's workspace root to this project directory.
   * Without this, Next.js 16 Turbopack detects ~/package.json as the root
   * (due to a ghost lockfile at the home dir level), which causes the
   * @tailwindcss/postcss resolver to walk up and fail to find `tailwindcss`
   * in the project's own node_modules.
   */
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'langfuse.com',
      },
    ],
  },
};

export default nextConfig;

