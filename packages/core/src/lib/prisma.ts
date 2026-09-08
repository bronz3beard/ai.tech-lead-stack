import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';
import pg from 'pg';

/**
 * Prisma Client with PostgreSQL adapter.
 * Uses robust environment variable loading and a lazy proxy pattern to ensure
 * zero-overhead, crash-free cold starts across serverless, edge, MCP, and CLI environments.
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

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  pool?: pg.Pool;
};

/**
 * Lazily initializes and returns the PostgreSQL connection pool.
 */
export function getPool(): pg.Pool {
  if (globalForPrisma.pool) {
    return globalForPrisma.pool;
  }
  loadEnv();

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

  const newPool = new pg.Pool({
    connectionString: rawUrl && rawUrl !== 'undefined' ? rawUrl : undefined,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.pool = newPool;
  }
  return newPool;
}

/**
 * Lazily initializes and returns the PrismaClient instance with PostgreSQL driver adapter.
 */
export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  loadEnv();

  const activePool = getPool();
  const adapter = new PrismaPg(activePool);
  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
        ? []
        : ['query'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * Transparent proxy for pg.Pool so existing imports like `import { pool }` continue to work.
 */
export const pool = new Proxy({} as pg.Pool, {
  get(target, prop, receiver) {
    const activePool = getPool();
    const value = Reflect.get(activePool, prop, receiver);
    return typeof value === 'function' ? value.bind(activePool) : value;
  },
});

/**
 * Transparent proxy for PrismaClient so existing imports like `import { prisma }` continue to work,
 * deferring client and connection pool instantiation until the first actual query execution.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

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
