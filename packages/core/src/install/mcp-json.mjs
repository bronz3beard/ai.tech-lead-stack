/**
 * Safe edits to editors' JSON config files (Claude Code, Cursor, Cline,
 * Gemini, Claude Desktop). These files also hold the editor's own state, so
 * only the keys asked for change: the rest is read and written back as-is.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Applies `update` to the parsed file ({} when it does not exist yet) and
 * writes the result. Keeps a .bak of the previous file and swaps the new one
 * in atomically. Returns false, writing nothing, when nothing changed. Throws
 * on a file that is not valid JSON rather than replacing it.
 */
export function updateJsonFile(file, update) {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  let config;
  try {
    config = JSON.parse(before || '{}');
  } catch {
    throw new Error(`${file} is not valid JSON; it was left as it was`);
  }
  const after = `${JSON.stringify(update(config), null, 2)}\n`;
  if (
    before &&
    JSON.stringify(JSON.parse(before)) === JSON.stringify(JSON.parse(after))
  ) {
    return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (before) fs.copyFileSync(file, `${file}.bak`);
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, after);
  fs.renameSync(tmp, file);
  return true;
}

/** Adds or replaces one server in a config's mcpServers map. */
export function withServer(config, name, server) {
  return {
    ...config,
    mcpServers: { ...(config.mcpServers ?? {}), [name]: server },
  };
}
