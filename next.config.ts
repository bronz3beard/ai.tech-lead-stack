import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  env: {
    // NextAuth v4 reads NEXTAUTH_*; Auth.js v5-style AUTH_* is common — bridge so either works.
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? process.env.AUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,

    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,

    DATABASE_URL: process.env.DATABASE_URL,

    GITHUB_ID: process.env.GITHUB_ID,
    GITHUB_SECRET: process.env.GITHUB_SECRET,
  },
};

export default nextConfig;
