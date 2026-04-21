import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Ensure environment variables are loaded for scripts
dotenv.config({ path: resolve(process.cwd(), '.env') });

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const connectionString = `${process.env.DATABASE_URL}`;
console.log(`[Database] Initializing with URL: ${connectionString.split('@')[1] || 'INVALID'}`);
const pool = new pg.Pool({ 
  connectionString,
  ssl: connectionString.includes('rlwy.net') ? { rejectUnauthorized: false } : false
});
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? [] : ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
