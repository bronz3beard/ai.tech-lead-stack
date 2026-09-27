#!/usr/bin/env node
/**
 * Entry point of the `tech-lead-stack` command (built to dist/mcp-server.mjs,
 * the file every existing editor config already starts).
 *
 * With no arguments it is the MCP server, exactly as before, so no existing
 * setup changes. Subcommands are loaded only when asked for, so the server
 * never runs their code and they never start the server.
 */
import fs from 'node:fs';

const USAGE = `Usage: tech-lead-stack [command]

  (no command)   Start the MCP server. This is what your editor runs.
  doctor         Check your setup. Read-only. Add --json for AI assistants.
  --version      Print the version.
  help           Show this message.`;

function packageVersion(): string {
  // dist/ sits next to the package.json, both in the npm package and in a clone.
  const manifest = new URL('../package.json', import.meta.url);
  return (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { version: string })
    .version;
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case undefined:
  case 'mcp':
    await import('../mcp-server/index.js');
    break;
  case 'doctor': {
    const { runDoctor } = await import('./doctor.js');
    process.exitCode = await runDoctor({ args, version: packageVersion() });
    break;
  }
  case '--version':
  case '-v':
    console.log(packageVersion());
    break;
  case 'help':
  case '--help':
  case '-h':
    console.log(USAGE);
    break;
  default:
    console.error(`Unknown command "${command}".\n\n${USAGE}`);
    process.exitCode = 2;
}
