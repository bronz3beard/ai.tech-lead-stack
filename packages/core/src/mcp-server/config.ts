import * as dotenv from 'dotenv';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { findRepoRoot } from '../lib/skills/repo-root.js';

/**
 * Robust environment configuration for the MCP server.
 * This is separated into its own module to ensure it can be imported
 * as the very first side-effect in the application entry point,
 * avoiding race conditions with hoisted ESM imports.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = findRepoRoot(__dirname);

// Where settings come from, first match wins (dotenv never overrides a
// variable that is already set):
//   1. the client's MCP `env` block (or a gateway passing its env down);
//   2. this stack's own .env (a clone; with npx this folder has none);
//   3. ~/.tech-lead-stack/.env, the one settings file for npx installs.
dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });
dotenv.config({
  path: path.join(os.homedir(), '.tech-lead-stack', '.env'),
  quiet: true,
});

// Never read .env from the current folder: an editor starts this server inside
// the user's project, and that file belongs to their app (see lib/prisma.ts).
process.env.TLS_SKIP_CWD_ENV = '1';

export { repoRoot };

