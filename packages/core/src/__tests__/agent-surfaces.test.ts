import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

/**
 * Guards the agent-agnostic surface index that every installer adapter reads.
 *
 * The index is the single place where a workflow launcher is mapped to the
 * skill it actually invokes. Those names diverge often (plan -> planning-expert),
 * so a stale or malformed index silently produces IDE commands that call a
 * skill which does not exist.
 */

const repoRoot = path.resolve(__dirname, '../../../..');
const surfacesFile = path.join(repoRoot, '.ai/agent-surfaces.json');

type SurfaceEntry = {
  name: string;
  skill: string;
  domain: string;
  domainKey: string;
  description: string;
  skillPath: string;
  workflowPath: string | null;
  surface: string;
  modes: string[];
  kind: string;
  mcpCallable: boolean;
  ideEligible: boolean;
};

describe('agent surface index', () => {
  let entries: SurfaceEntry[];

  beforeAll(() => {
    const raw = JSON.parse(fs.readFileSync(surfacesFile, 'utf8'));
    entries = raw.entries;
  });

  it('exists and is not empty', () => {
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('gives every entry a unique command name', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const entry of entries) {
      if (seen.has(entry.name)) duplicates.push(entry.name);
      seen.add(entry.name);
    }
    expect(duplicates).toEqual([]);
  });

  it('uses command names that are safe as filenames and slash commands', () => {
    const invalid = entries
      .map((e) => e.name)
      .filter((name) => !/^[a-z0-9][a-z0-9-]*$/.test(name));
    expect(invalid).toEqual([]);
  });

  it('resolves every entry to a skill file that exists on disk', () => {
    const missing = entries
      .filter((e) => !fs.existsSync(path.join(repoRoot, e.skillPath)))
      .map((e) => `${e.name} -> ${e.skillPath}`);
    expect(missing).toEqual([]);
  });

  it('resolves every entry to the skill name that file declares', () => {
    const mismatched: string[] = [];
    for (const entry of entries) {
      const { data } = matter(
        fs.readFileSync(path.join(repoRoot, entry.skillPath), 'utf8'),
      );
      if (data.name !== entry.skill) {
        mismatched.push(`${entry.name}: index says ${entry.skill}, file says ${data.name}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('points every declared workflow path at a file that exists', () => {
    const missing = entries
      .filter((e) => e.workflowPath)
      .filter((e) => !fs.existsSync(path.join(repoRoot, e.workflowPath!)))
      .map((e) => `${e.name} -> ${e.workflowPath}`);
    expect(missing).toEqual([]);
  });

  it('never offers a skill to an IDE unless it declares mode "mcp"', () => {
    const offending = entries
      .filter((e) => e.ideEligible && !e.modes.includes('mcp'))
      .map((e) => `${e.name} (skill: ${e.skill}, modes: ${e.modes.join(', ')})`);
    expect(offending).toEqual([]);
  });

  it('keeps mcpCallable consistent with the declared modes', () => {
    const inconsistent = entries
      .filter((e) => e.mcpCallable !== e.modes.includes('mcp'))
      .map((e) => e.name);
    expect(inconsistent).toEqual([]);
  });

  it('never offers an internal skill that no workflow launches', () => {
    const leaked = entries
      .filter((e) => e.surface === 'internal' && !e.workflowPath && e.ideEligible)
      .map((e) => e.name);
    expect(leaked).toEqual([]);
  });

  it('gives every entry a non-empty description for the command picker', () => {
    const blank = entries.filter((e) => !e.description?.trim()).map((e) => e.name);
    expect(blank).toEqual([]);
  });

  it('assigns every entry to a known domain', () => {
    const unknown = entries
      .filter((e) => !['eng', 'pm', 'hr'].includes(e.domainKey))
      .map((e) => `${e.name} -> ${e.domainKey}`);
    expect(unknown).toEqual([]);
  });

  it('covers every workflow launcher in the repo', () => {
    const workflowDirs = [
      '.agents/workflows',
      '.agents/pm-workflows',
      '.agents/hr-workflows',
    ];
    const indexed = new Set(
      entries.filter((e) => e.workflowPath).map((e) => e.workflowPath),
    );

    const uncovered: string[] = [];
    for (const dir of workflowDirs) {
      const abs = path.join(repoRoot, dir);
      if (!fs.existsSync(abs)) continue;
      for (const file of fs.readdirSync(abs).filter((f) => f.endsWith('.md'))) {
        const rel = `${dir}/${file}`;
        if (!indexed.has(rel)) uncovered.push(rel);
      }
    }
    expect(uncovered).toEqual([]);
  });
});
