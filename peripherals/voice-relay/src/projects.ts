import fs from 'node:fs';
import path from 'node:path';

export interface ProjectEntry {
  id: string; // The basename
  path: string; // Absolute path to the repo
  name: string; // Display name
  aliases: string[]; // Spoken aliases
}

export interface ProjectAliases {
  _ignore?: string[];
  [key: string]: any;
}

const getDirname = () => {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  const cwd = process.cwd();
  return cwd.endsWith('voice-relay') 
    ? path.join(cwd, 'src') 
    : path.join(cwd, 'peripherals/voice-relay/src');
};

const ALIASES_PATH = path.resolve(getDirname(), '../project-aliases.json');

function loadAliases(): ProjectAliases {
  try {
    return JSON.parse(fs.readFileSync(ALIASES_PATH, 'utf8'));
  } catch {
    return { _ignore: [] };
  }
}

export function scanProjects(roots: string | undefined): ProjectEntry[] {
  if (!roots) return [];

  const rootPaths = roots.split(',').map(r => r.trim()).filter(Boolean);
  const aliasesOverlay = loadAliases();
  const ignoreList = new Set(aliasesOverlay._ignore || []);

  const MAX_DEPTH = 6;
  const MAX_COUNT = 500;
  const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.cache']);
  
  const found = new Map<string, ProjectEntry>();

  function walk(dir: string, depth: number) {
    if (depth > MAX_DEPTH) return;
    if (found.size >= MAX_COUNT) return;

    let stat;
    try {
      stat = fs.lstatSync(dir);
    } catch {
      return;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) return;

    // Check if it's a project
    const gitPath = path.join(dir, '.git');
    let hasGit = false;
    try {
      const gitStat = fs.statSync(gitPath);
      hasGit = gitStat.isDirectory() || gitStat.isFile(); // .git can be a file in submodules/worktrees
    } catch {
      hasGit = false;
    }

    if (hasGit) {
      const resolvedPath = path.resolve(dir);
      const id = path.basename(resolvedPath);
      
      // Check ignore
      if (ignoreList.has(id) || ignoreList.has(resolvedPath)) {
        return; // Ignored
      }
      
      // It's a project! Prune recursion.
      if (!found.has(resolvedPath)) {
        const overlay = aliasesOverlay[id] || {};
        found.set(resolvedPath, {
          id,
          path: resolvedPath,
          name: overlay.name || id,
          aliases: overlay.aliases || [],
        });
      }
      return; // DO NOT descend into it (prune)
    }

    // Otherwise, descend
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.startsWith('.') || SKIP_DIRS.has(entry)) {
        continue;
      }
      walk(path.join(dir, entry), depth + 1);
    }
  }

  for (const rootPath of rootPaths) {
    walk(path.resolve(rootPath), 0);
  }

  return Array.from(found.values());
}

let _projects: ProjectEntry[] = [];
let _mockProjects: ProjectEntry[] | null = null;

export function __setMockProjects(mocks: ProjectEntry[] | null) {
  _mockProjects = mocks;
}

export function refreshProjects(): ProjectEntry[] {
  if (_mockProjects) {
    _projects = _mockProjects;
    return _projects;
  }
  const roots = process.env.PROJECT_ROOTS;
  _projects = scanProjects(roots);
  return _projects;
}

export function getProjects(): ProjectEntry[] {
  if (_mockProjects) return _mockProjects;
  if (_projects.length === 0) {
    return refreshProjects();
  }
  return _projects;
}
