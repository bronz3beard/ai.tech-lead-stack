import type { NextConfig } from 'next';

import path from 'path';

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
  },
  transpilePackages: ['@zenithfoundry/tech-lead-stack'],
  /**
   * Pins Turbopack's workspace root to the monorepo root.
   */
  turbopack: {
    root: path.resolve(__dirname, '../../'),
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
  /**
   * NOTE: The previous `headers()` block set
   *   Cross-Origin-Embedder-Policy: require-corp
   *   Cross-Origin-Opener-Policy: same-origin
   * on every route. `require-corp` makes the page cross-origin isolated, which
   * blocks ANY cross-origin resource that doesn't send a matching CORP header —
   * including the Vercel Live feedback script AND, critically, the E2B sandbox
   * preview <iframe> (served from *.e2b.app). That prevents the preview from
   * ever rendering. Nothing in this app needs cross-origin isolation
   * (no SharedArrayBuffer / crossOriginIsolated usage), so the headers are
   * removed. If you later need COOP/COEP for a specific feature, scope it to
   * the routes that need it — never to the page that embeds the sandbox iframe.
   */
};

export default nextConfig;
