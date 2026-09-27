/**
 * Reads and edits the MCP servers in Continue's ~/.continue/config.yaml.
 *
 * Continue lists servers as a sequence (`- name: ... command: ... args: ...`).
 * Older installs of this toolbox wrote a map entry (`tech-lead-stack:` as a
 * key) that Continue does not read; every function here also understands that
 * shape, and writing converts it to the list Continue expects.
 *
 * The `yaml` package keeps the user's comments and formatting, which a plain
 * load-and-dump would throw away.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isMap, isSeq, parseDocument } from 'yaml';

function parse(text) {
  const doc = parseDocument(text ?? '');
  if (doc.errors.length > 0) {
    throw new Error(`not valid YAML: ${doc.errors[0].message}`);
  }
  return doc;
}

/** Map-shaped servers ({ name: { command } }) as the list Continue expects. */
const mapToList = (map) =>
  Object.entries(map.toJSON() ?? {}).map(([name, server]) => ({
    name,
    ...server,
  }));

/** Every configured server as a plain object with a `name`. */
export function listContinueServers(text) {
  const servers = parse(text).get('mcpServers', true);
  if (isSeq(servers)) {
    return servers.toJSON().filter((s) => s && typeof s === 'object');
  }
  if (isMap(servers)) return mapToList(servers);
  return [];
}

/** Adds `server`, or replaces the entry with the same name. */
export function setContinueServer(text, server) {
  const doc = parse(text);
  let servers = doc.get('mcpServers', true);
  if (isMap(servers)) {
    doc.set('mcpServers', doc.createNode(mapToList(servers)));
    servers = doc.get('mcpServers', true);
  }
  if (!isSeq(servers)) {
    doc.set('mcpServers', doc.createNode([]));
    servers = doc.get('mcpServers', true);
  }
  const node = doc.createNode(server);
  const index = servers.items.findIndex(
    (item) => isMap(item) && item.get('name') === server.name
  );
  if (index >= 0) servers.items[index] = node;
  else servers.items.push(node);
  return doc.toString();
}

/** Removes every server `matches` accepts. Returns the new text and names. */
export function removeContinueServers(text, matches) {
  const doc = parse(text);
  const servers = doc.get('mcpServers', true);
  const removed = [];
  if (isSeq(servers)) {
    servers.items = servers.items.filter((item) => {
      const server = item?.toJSON?.();
      if (!server || !matches(server)) return true;
      removed.push(server.name);
      return false;
    });
  } else if (isMap(servers)) {
    for (const server of mapToList(servers)) {
      if (!matches(server)) continue;
      servers.delete(server.name);
      removed.push(server.name);
    }
  }
  return { text: doc.toString(), removed };
}

/** Keeps a .bak of the previous file and swaps the new text in atomically. */
function replaceFile(file, before, after) {
  if (after === before) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (before) fs.copyFileSync(file, `${file}.bak`);
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, after);
  fs.renameSync(tmp, file);
  return true;
}

/** Writes `server` into a Continue config file, creating it if needed. */
export function writeContinueServer({ file, server }) {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  return replaceFile(file, before, setContinueServer(before, server));
}

/** Removes the server called `name` from a Continue config file. */
export function removeContinueServerFromFile({ file, name }) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, 'utf8');
  const { text } = removeContinueServers(before, (s) => s.name === name);
  return replaceFile(file, before, text);
}
