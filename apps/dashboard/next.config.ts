import type { NextConfig } from 'next';

import fs from 'fs';
import path from 'path';

// Local setups keep one .env at the repo root; Next.js only reads this app's
// folder. Hosted deploys set variables in the platform and have no file here.
// Variables that are already set always win.
const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  transpilePackages: ['@zenithfoundry/tech-lead-stack'],
  /**
   * Required for Vercel to correctly trace files (like Prisma engines) outside this app folder.
   */
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
  /**
   * Pins Turbopack's workspace root to the monorepo root.
   */
  turbopack: {
    root: path.resolve(__dirname, '../../'),
  },
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-pg',
    'pg',
    'bcryptjs',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
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
