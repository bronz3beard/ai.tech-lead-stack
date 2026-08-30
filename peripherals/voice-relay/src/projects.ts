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

  function walk(dir: string, rootDir: string, depth: number) {
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
      const name = path.basename(resolvedPath);
      const id = path.relative(rootDir, resolvedPath) || name;
      
      // Check ignore
      if (ignoreList.has(id) || ignoreList.has(resolvedPath)) {
        return; // Ignored
      }
      
      // It's a project! Prune recursion.
      if (!found.has(resolvedPath)) {
        const overlay = aliasesOverlay[id] || aliasesOverlay[name] || {};
        found.set(resolvedPath, {
          id,
          path: resolvedPath,
          name: overlay.name || name,
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
      walk(path.join(dir, entry), rootDir, depth + 1);
    }
  }

  for (const rootPath of rootPaths) {
    const absRoot = path.resolve(rootPath);
    walk(absRoot, absRoot, 0);
  }

  const projects = Array.from(found.values());
  
  // Handle name collisions
  const nameCounts = new Map<string, number>();
  for (const p of projects) {
    nameCounts.set(p.name, (nameCounts.get(p.name) || 0) + 1);
  }
  
  for (const p of projects) {
    if (nameCounts.get(p.name)! > 1) {
      const parentDir = path.basename(path.dirname(p.path));
      if (parentDir && parentDir !== '.' && parentDir !== path.basename(p.path)) {
        p.name = `${p.name} — ${parentDir}`;
      }
    }
  }

  return projects;
}

export interface ResolveProjectResult {
  kind: 'matched' | 'need-project';
  project?: ProjectEntry;
  projects?: ProjectEntry[];
  remainingTranscript?: string;
  message?: string;
}

export function resolveProject(
  transcript: string,
  explicitProjectId: string | undefined,
  allProjects: ProjectEntry[]
): ResolveProjectResult {
  let matchedProject: ProjectEntry | undefined;
  let remainingTranscript = transcript;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const t = norm(transcript);

  if (explicitProjectId) {
    matchedProject = allProjects.find((p) => p.id === explicitProjectId);
    if (matchedProject) {
      return { kind: 'matched', project: matchedProject, remainingTranscript };
    }
  }

  const candidates: { p: ProjectEntry; alias: string }[] = [];
  for (const p of allProjects) {
    const aliasesToMatch = [p.name, ...(p.aliases || [])];
    for (const a of aliasesToMatch) {
      const na = norm(a);
      if (!na) continue;
      if (t === na || t.startsWith(na + ' ')) {
        candidates.push({ p, alias: na });
      }
    }
  }

  if (candidates.length > 0) {
    const maxLen = Math.max(...candidates.map((c) => c.alias.length));
    const bestCandidates = candidates.filter((c) => c.alias.length === maxLen);
    const uniqueProjects = Array.from(new Set(bestCandidates.map((c) => c.p)));
    
    if (uniqueProjects.length === 1) {
      matchedProject = uniqueProjects[0];
      const bestAliasMatch = bestCandidates.find((c) => c.p === matchedProject)!;
      remainingTranscript = t.slice(bestAliasMatch.alias.length).trim();
      return { kind: 'matched', project: matchedProject, remainingTranscript };
    } else if (uniqueProjects.length > 1) {
      return {
        kind: 'need-project',
        projects: uniqueProjects,
        message: 'I found multiple projects matching that name — which one?',
      };
    }
  }

  return {
    kind: 'need-project',
    projects: allProjects,
    message: "I'm not sure which project you'd like me to work in. Tell me the project, then the skill, then what you'd like - for example, 'Homegrid, plan, add rate limiting.'",
  };
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
