#!/usr/bin/env node
/**
 * Builds dist/mcp-server.mjs, the `tech-lead-stack` command the npm package
 * runs (src/cli/main.ts): the MCP server, plus subcommands such as `doctor`.
 *
 * One thing here needs esbuild's JS API rather than its CLI: the bare
 * `@prisma/client` import goes to the ESM client generated for this bundle
 * (the `mcp` generator in prisma/schema.prisma), while that client's own
 * `@prisma/client/runtime/...` imports stay external npm dependencies. The
 * CLI's --alias would rewrite those subpaths too.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedClient = path.join(core, 'src/generated/mcp-prisma/client.ts');

if (!fs.existsSync(generatedClient)) {
  console.error(
    `${generatedClient} is missing. Run: pnpm run db:generate (it also runs on install).`
  );
  process.exit(1);
}

await build({
  // The command dispatcher: no arguments starts the MCP server.
  entryPoints: [path.join(core, 'src/cli/main.ts')],
  outfile: path.join(core, 'dist/mcp-server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  plugins: [
    {
      name: 'mcp-prisma-client',
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^@prisma\/client$/ }, () => ({
          path: generatedClient,
        }));
      },
    },
  ],
});
