/**
 * Stands in for '@prisma/client' in the MCP server bundle only (see the
 * `--alias` in this package's `mcp:build` script); the dashboard and tests use
 * the real module.
 *
 * The npm package installs without a generated Prisma client, and a static
 * `import { PrismaClient } from '@prisma/client'` then crashes the server at
 * startup. This loads the real client the first time one is constructed, so
 * the server runs without a database and database telemetry fails on its own,
 * inside the telemetry service's existing error handling.
 */
import { createRequire } from 'module';
import type { PrismaClient as RealPrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);

export const PrismaClient = function (...args: unknown[]) {
  let Real: new (...ctorArgs: unknown[]) => RealPrismaClient;
  try {
    ({ PrismaClient: Real } = require('@prisma/client'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') throw err;
    throw new Error(
      'Database features are unavailable: this install has no generated Prisma client.'
    );
  }
  return new Real(...args);
} as unknown as typeof RealPrismaClient;
