import { WebContainer } from '@webcontainer/api';

/**
 * Recursively scans WebContainer filesystem, ignoring system and binary paths like node_modules and .next.
 */
export async function scanFileSystem(
  instance: WebContainer,
  dir = '.'
): Promise<{ path: string; status: 'done' }[]> {
  let results: { path: string; status: 'done' }[] = [];
  try {
    const files = await instance.fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const path = dir === '.' ? file.name : `${dir}/${file.name}`;

      // STRICT EXCLUSIONS: Do not crawl these or their subdirectories
      if (
        file.name === 'node_modules' ||
        file.name === '.git' ||
        file.name === '.next' ||
        file.name === '.pnpm' ||
        file.name === '.turbo'
      ) {
        continue;
      }

      if (file.isDirectory()) {
        const sub = await scanFileSystem(instance, path);
        results = [...results, ...sub];
      } else {
        results.push({ path, status: 'done' });
      }
    }
  } catch (e) {
    // Fallback for older WebContainer API or permission issues
    try {
      const files = await instance.fs.readdir(dir);
      for (const file of files) {
        if (
          file === 'node_modules' ||
          file === '.git' ||
          file === '.next' ||
          file === '.pnpm' ||
          file === '.turbo'
        )
          continue;
        const path = dir === '.' ? file : `${dir}/${file}`;
        results.push({ path, status: 'done' });
      }
    } catch {}
  }
  return results;
}
