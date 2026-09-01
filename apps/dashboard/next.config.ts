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
