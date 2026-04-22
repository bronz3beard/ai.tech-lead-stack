import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Robust environment configuration for the MCP server.
 * This is separated into its own module to ensure it can be imported
 * as the very first side-effect in the application entry point,
 * avoiding race conditions with hoisted ESM imports.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../');

dotenv.config({ path: path.join(repoRoot, '.env') });

export { repoRoot };
