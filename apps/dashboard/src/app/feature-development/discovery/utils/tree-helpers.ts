import { FileNode } from '../types';

/**
 * Recursively flattens a FileSystemTree into a flat list of file paths.
 */
export function flattenTree(
  tree: any,
  parentPath = ''
): { path: string; status: 'writing' | 'done' | 'error' }[] {
  let files: { path: string; status: 'writing' | 'done' | 'error' }[] = [];
  for (const name in tree) {
    const item = tree[name];
    const currentPath = parentPath ? `${parentPath}/${name}` : name;
    if (item.directory) {
      files = [...files, ...flattenTree(item.directory, currentPath)];
    } else {
      files.push({ path: currentPath, status: 'done' });
    }
  }
  return files;
}

/**
 * Builds a nested FileNode directory tree from a flat list of file status objects.
 */
export function buildTree(files: { path: string; status: any }[]): FileNode[] {
  const root: FileNode[] = [];

  files.forEach((file) => {
    const parts = file.path.split('/');
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        existingNode = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          isDirectory: !isLast,
          children: isLast ? undefined : [],
          status: isLast ? file.status : undefined,
        };
        currentLevel.push(existingNode);
        currentLevel.sort((a, b) => {
          if (a.isDirectory === b.isDirectory)
            return a.name.localeCompare(b.name);
          return a.isDirectory ? -1 : 1;
        });
      }
      if (!isLast) {
        currentLevel = existingNode.children!;
      }
    });
  });

  return root;
}
