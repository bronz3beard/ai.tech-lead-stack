import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

import { FileSystemService } from '../lib/skills/fs-service';
import { SkillHandlers } from '../mcp-server/handlers/skills';

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
  fetchName: string;
  skill: string;
  cost: string;
  costTokens: number;
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

/**
 * Builds the real handlers against the real repo. Only telemetry and KI
 * persistence are stubbed - resolution is exactly what the MCP server does,
 * which is the whole point of the round-trip tests below.
 */
function buildHandlers() {
  const fsService = new FileSystemService(repoRoot, null);
  const telemetry = {
    withAnalytics: <T>(
      _skill: string,
      _project: string | undefined,
      _model: string | undefined,
      _agent: string | undefined,
      _cost: string | undefined,
      run: () => Promise<T>
    ) => run(),
  };
  const kiService = { upsertKnowledgeItem: async () => undefined };

  return new SkillHandlers(
    fsService,
    // Structurally an ITelemetry/KiService; cast because the handler declares
    // the concrete classes, which drag Prisma into the test process.
    telemetry as unknown as ConstructorParameters<typeof SkillHandlers>[1],
    kiService as unknown as ConstructorParameters<typeof SkillHandlers>[2]
  );
}

const textOf = (result: { content: { text: string }[] }) =>
  result.content.map((c) => c.text).join('\n');

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

  it('gives every entry the filename get_skills resolves by', () => {
    const wrong = entries
      .filter((e) => e.fetchName !== path.basename(e.skillPath, '.md'))
      .map((e) => `${e.name}: fetchName ${e.fetchName}, file ${e.skillPath}`);
    expect(wrong).toEqual([]);
  });

  it('uses fetch names that are safe as filenames and slash commands', () => {
    const invalid = entries
      .map((e) => e.fetchName)
      .filter((fetchName) => !/^[a-z0-9][a-z0-9-]*$/.test(fetchName));
    expect(invalid).toEqual([]);
  });

  it('declares every cost in the format the skill validator enforces', () => {
    const malformed = entries
      .filter((e) => !/^~[0-9]+\s+tokens$/.test(e.cost))
      .map((e) => `${e.name}: "${e.cost}"`);
    expect(malformed).toEqual([]);
  });

  it('keeps every declared cost within 25% of the measured file size', () => {
    const drifted = entries
      .filter((e) => {
        const declared = Number(e.cost.match(/[0-9]+/)?.[0] ?? NaN);
        return (
          !Number.isFinite(declared) ||
          Math.abs(declared - e.costTokens) / e.costTokens > 0.25
        );
      })
      .map((e) => `${e.name}: declared ${e.cost}, measured ~${e.costTokens}`);
    expect(drifted).toEqual([]);
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

/**
 * The index is only worth having if the MCP tools honour it. These drive the
 * real handlers: before aliasing existed, every launcher name whose file name
 * differs from its skill (vertical-slice -> vertical-slice-decomposer) failed
 * here, while the index happily advertised it.
 */
describe('MCP skill surface honours the index', () => {
  let entries: SurfaceEntry[];
  let handlers: ReturnType<typeof buildHandlers>;

  beforeAll(() => {
    entries = JSON.parse(fs.readFileSync(surfacesFile, 'utf8')).entries;
    handlers = buildHandlers();
  });

  it('fetches every indexed entry by the name the index advertises', async () => {
    const failed: string[] = [];
    for (const entry of entries) {
      const result = await handlers.handleGetSkill('get_skills', {
        skillName: entry.name,
        projectName: 'agent-surfaces-test',
        model: 'test',
        agent: 'test',
      });
      if (result.isError) failed.push(`${entry.name}: ${textOf(result)}`);
    }
    expect(failed).toEqual([]);
  });

  it('flags an aliased fetch so the caller sees which skill answered', async () => {
    const aliased = entries.find((e) => e.name !== e.fetchName)!;
    const result = await handlers.handleGetSkill('get_skills', {
      skillName: aliased.name,
      projectName: 'agent-surfaces-test',
      model: 'test',
      agent: 'test',
    });

    expect(result.isError).toBe(false);
    expect(textOf(result).split('\n')[0]).toBe(
      `[resolved] ${aliased.name} -> ${aliased.fetchName} (workflow launcher name)`
    );
  });

  it('never lists an identifier that get_skills rejects', async () => {
    const listed = textOf(await handlers.handleListSkills())
      .split('\n')
      .map((line) => line.match(/^- (\S+)/)?.[1])
      .filter((id): id is string => !!id);

    expect(listed.length).toBeGreaterThan(0);

    const rejected: string[] = [];
    for (const id of Array.from(new Set(listed))) {
      const result = await handlers.handleGetSkill('get_skills', {
        skillName: id,
        projectName: 'agent-surfaces-test',
        model: 'test',
        agent: 'test',
      });
      if (result.isError) rejected.push(id);
    }
    expect(rejected).toEqual([]);
  });
});
