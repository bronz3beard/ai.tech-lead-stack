import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';
import pg from 'pg';

/**
 * Prisma Client with PostgreSQL adapter.
 * Uses robust environment variable loading to ensure connectivity
 * across different entry points (Next.js, MCP server, CLI scripts).
 */

const loadEnv = () => {
  // If we're already configured (e.g. by index.ts), skip redundant work
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== 'undefined')
    return;

  try {
    const root = resolve(process.cwd());
    dotenv.config({ path: join(root, '.env') });

    // Fallback if not found in CWD
    if (!process.env.DATABASE_URL) {
      // Use __dirname for script-relative resolution.
      // tsx/ts-node usually shim this even in ESM.
      try {
        dotenv.config({ path: resolve(__dirname, '../../.env') });
      } catch {
        // Ignore if __dirname is not available
      }
    }
  } catch (err) {
    console.warn('[Database] Environment loading skipped:', err);
  }
};

loadEnv();

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  pool?: pg.Pool;
};

const rawUrl = process.env.DATABASE_URL || '';
const isSsl =
  Boolean(rawUrl) &&
  (rawUrl.includes('rlwy.net') ||
    rawUrl.includes('neon.tech') ||
    rawUrl.includes('supabase.co') ||
    rawUrl.includes('sslmode=require') ||
    (process.env.NODE_ENV === 'production' &&
      !rawUrl.includes('localhost') &&
      !rawUrl.includes('127.0.0.1')));

export const pool =
  globalForPrisma.pool ||
  new pg.Pool({
    connectionString: rawUrl || undefined,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
        ? []
        : ['query'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

export async function disconnectPrisma(): Promise<void> {
  try {
    if (globalForPrisma.prisma) {
      await globalForPrisma.prisma.$disconnect();
    }
    if (globalForPrisma.pool) {
      await globalForPrisma.pool.end();
    }
  } catch {
    // Ignore teardown errors
  }
}
