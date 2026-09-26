import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';
import pg from 'pg';
import type { ConnectionOptions } from 'tls';

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

// Managed hosts that require TLS. `supabase.com` covers Supabase's pooler hosts.
const SSL_HOST_SUFFIXES = [
  'rlwy.net',
  'neon.tech',
  'supabase.co',
  'supabase.com',
];
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/**
 * Decides whether a connection string needs TLS. Matches on the parsed
 * hostname, not a substring, so e.g. `evil.com/?x=neon.tech` does not count.
 */
export function shouldUseSsl(rawUrl: string, nodeEnv?: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  // Non-special schemes like postgres:// keep the host's original casing.
  const host = url.hostname.toLowerCase();
  const isManagedHost = SSL_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );

  return (
    isManagedHost ||
    url.searchParams.get('sslmode') === 'require' ||
    (nodeEnv === 'production' && !LOCAL_HOSTS.includes(host))
  );
}

// libpq's sslmode names for the modes that encrypt.
const SSL_MODES = ['verify-full', 'verify-ca', 'no-verify'] as const;
type SslMode = (typeof SSL_MODES)[number];

const isSslMode = (value: string): value is SslMode =>
  (SSL_MODES as readonly string[]).includes(value);

const PEM_CERTIFICATE =
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

/**
 * Pulls the PEM certificate block(s) out of DATABASE_SSL_CA. Tolerates `\n`
 * escapes (single-line env values) and surrounding text, e.g. Railway's
 * root.crt, which starts with an `openssl -text` dump before the PEM block.
 */
function extractPemCertificates(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const blocks = value.replace(/\\n/g, '\n').match(PEM_CERTIFICATE);
  if (!blocks) {
    throw new Error(
      'DATABASE_SSL_CA must contain a PEM certificate (-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----)'
    );
  }
  return blocks.join('\n');
}

/**
 * TLS options for the pool, chosen by DATABASE_SSL_MODE:
 * - `verify-full` (default): trusted chain AND hostname match.
 * - `verify-ca`: trusted chain only. For private-CA providers whose cert does
 *   not name the public host (Railway's is issued to `localhost`).
 *   Requires DATABASE_SSL_CA.
 * - `no-verify`: encrypted but unauthenticated; last resort.
 * DATABASE_SSL_CA is the provider's CA as PEM (`\n` escapes allowed).
 */
export function getSslOptions(env: NodeJS.ProcessEnv): ConnectionOptions {
  const mode = env.DATABASE_SSL_MODE ?? 'verify-full';
  if (!isSslMode(mode)) {
    throw new Error(
      `DATABASE_SSL_MODE must be one of ${SSL_MODES.join(', ')}; got "${mode}"`
    );
  }

  const ca = extractPemCertificates(env.DATABASE_SSL_CA);

  if (mode === 'no-verify') {
    return { rejectUnauthorized: false };
  }
  if (mode === 'verify-ca' && !ca) {
    throw new Error('DATABASE_SSL_MODE=verify-ca requires DATABASE_SSL_CA');
  }

  return {
    rejectUnauthorized: true,
    ...(ca && { ca }),
    // The chain is still verified; only the hostname comparison is skipped.
    ...(mode === 'verify-ca' && { checkServerIdentity: () => undefined }),
  };
}

/**
 * Lazily initializes and returns the PostgreSQL connection pool.
 */
export function getPool(): pg.Pool {
  if (globalForPrisma.pool) {
    return globalForPrisma.pool;
  }
  loadEnv();

  const rawUrl = process.env.DATABASE_URL || '';

  const ssl = shouldUseSsl(rawUrl, process.env.NODE_ENV)
    ? getSslOptions(process.env)
    : false;
  if (ssl && !ssl.rejectUnauthorized) {
    console.warn(
      '[Database] TLS certificate verification is DISABLED (DATABASE_SSL_MODE=no-verify).'
    );
  }

  const newPool = new pg.Pool({
    connectionString: rawUrl && rawUrl !== 'undefined' ? rawUrl : undefined,
    ssl,
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
