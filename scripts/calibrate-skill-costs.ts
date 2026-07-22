/**
 *
 * Closes the loop between the hand-authored `cost: ~N tokens` estimate in each
 * skill's frontmatter and what the skill ACTUALLY costs once Langfuse-enriched
 * actuals have landed in Postgres (AnalyticsEvent.totalTokens).
 *
 * What it does:
 *   1. Loads every skill's declared estimate from .ai/skills + .ai/pm-skills.
 *   2. Pulls SUCCESS events per skill from Postgres and computes p50 / p95 / mean.
 *   3. Prints a drift report (observed p50 vs declared estimate), sorted by |drift|.
 *   4. With --write, rewrites the `cost:` line of any skill that has enough
 *      samples and drifts beyond the threshold (rounded to the nearest 50 tokens
 *      to match the repo's existing style + the strict `~N tokens` validator).
 *
 * Run:
 *   npx tsx scripts/calibrate-skill-costs.ts
 *   npx tsx scripts/calibrate-skill-costs.ts --min 30 --threshold 0.30
 *   npx tsx scripts/calibrate-skill-costs.ts --write        # rewrite frontmatter
 *
 * Note: src/lib/prisma.ts self-loads .env, so no dotenv wiring is needed here.
 * Use RELATIVE imports only (this runs under tsx, where '@/' does not resolve).
 */
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';

import { prisma } from '../src/lib/prisma';
import { normalizeSkillName } from '../src/lib/trace-utils';

const SKILL_DIRS = ['.ai/skills', '.ai/pm-skills'];
const COST_RE = /^cost:\s*~\s*([0-9]+)\s+tokens\s*$/im;

interface Declared {
  name: string; // normalized
  file: string;
  estimate: number; // tokens
}

interface Observed {
  n: number;
  p50: number;
  p95: number;
  mean: number;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (flag: string) => process.argv.includes(flag);

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.floor((p / 100) * sortedAsc.length)
  );
  return sortedAsc[idx];
}

function roundTo(n: number, step = 50): number {
  return Math.max(step, Math.round(n / step) * step);
}

/** Read declared estimates from skill frontmatter. */
function loadDeclared(): Declared[] {
  const out: Declared[] = [];
  for (const dir of SKILL_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const file = path.join(dir, f);
      const parsed = matter(fs.readFileSync(file, 'utf-8'));
      const raw = (parsed.data.name as string) || f.replace(/\.md$/, '');
      const costStr = String(parsed.data.cost ?? '');
      const m = costStr.match(/~\s*([0-9]+)\s+tokens/);
      if (!m) continue; // skills without a parseable cost are skipped
      out.push({ name: normalizeSkillName(raw), file, estimate: Number(m[1]) });
    }
  }
  return out;
}

/** Bucket observed token counts per skill from Postgres. */
async function loadObserved(): Promise<Map<string, Observed>> {
  const rows = await prisma.analyticsEvent.findMany({
    where: { status: 'SUCCESS', totalTokens: { gt: 0 } },
    select: { skillName: true, totalTokens: true },
  });

  const buckets = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.skillName || r.totalTokens == null) continue;
    const key = normalizeSkillName(r.skillName);
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(r.totalTokens);
  }

  const observed = new Map<string, Observed>();
  for (const [key, values] of buckets) {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    observed.set(key, {
      n: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      mean: Math.round(mean),
    });
  }
  return observed;
}

/** Targeted rewrite of just the cost line — avoids reflowing the YAML block. */
function rewriteCost(file: string, newTokens: number): boolean {
  const src = fs.readFileSync(file, 'utf-8');
  if (!COST_RE.test(src)) return false;
  fs.writeFileSync(
    file,
    src.replace(COST_RE, `cost: ~${newTokens} tokens`),
    'utf-8'
  );
  return true;
}

async function main() {
  const minSamples = Number(arg('--min') ?? 20);
  const threshold = Number(arg('--threshold') ?? 0.3); // 30% drift
  const write = hasFlag('--write');

  const declared = loadDeclared();
  const observed = await loadObserved();

  interface Row extends Declared {
    obs?: Observed;
    driftPct?: number;
    actionable: boolean;
    suggestion?: number;
  }

  const report: Row[] = declared.map((d) => {
    const obs = observed.get(d.name);
    if (!obs || obs.n < minSamples) return { ...d, obs, actionable: false };
    const driftPct = (obs.p50 - d.estimate) / d.estimate;
    const actionable = Math.abs(driftPct) >= threshold;
    return { ...d, obs, driftPct, actionable, suggestion: roundTo(obs.p50) };
  });

  report.sort((a, b) => Math.abs(b.driftPct ?? 0) - Math.abs(a.driftPct ?? 0));

  const pct = (v?: number) =>
    v == null ? '   —  ' : `${(v * 100).toFixed(0).padStart(4)}%`;
  console.log('\nSKILL COST CALIBRATION');
  console.log(
    `min samples=${minSamples}  drift threshold=${(threshold * 100).toFixed(0)}%  write=${write}\n`
  );
  console.log(
    'skill'.padEnd(38),
    'n'.padStart(5),
    'est'.padStart(6),
    'p50'.padStart(7),
    'p95'.padStart(7),
    'drift'.padStart(7),
    '  suggest'
  );
  console.log('-'.repeat(92));

  let toWrite = 0;
  for (const r of report) {
    const n = r.obs ? String(r.obs.n) : '0';
    const p50 = r.obs ? String(r.obs.p50) : '—';
    const p95 = r.obs ? String(r.obs.p95) : '—';
    const flag = r.actionable
      ? r.driftPct! > 0
        ? '  ⬆ under-budgeted'
        : '  ⬇ over-budgeted'
      : '';
    const suggest = r.actionable ? `~${r.suggestion}` : '';
    console.log(
      r.name.padEnd(38),
      n.padStart(5),
      String(r.estimate).padStart(6),
      p50.padStart(7),
      p95.padStart(7),
      pct(r.driftPct),
      `  ${suggest}${flag}`
    );
    if (write && r.actionable && r.suggestion) {
      if (rewriteCost(r.file, r.suggestion)) {
        toWrite++;
        console.log(
          `      ↳ wrote ${r.file}: ~${r.estimate} → ~${r.suggestion} tokens`
        );
      }
    }
  }

  const stale = report.filter((r) => r.actionable).length;
  console.log('\nSummary:');
  console.log(`  skills with estimates:        ${report.length}`);
  console.log(`  with >= ${minSamples} samples & drifting:  ${stale}`);
  if (write) console.log(`  frontmatter files rewritten:  ${toWrite}`);
  else if (stale)
    console.log('  re-run with --write to update the drifting estimates.');

  await prisma.$disconnect();
  // Non-zero exit if drift found and not writing — lets you gate this in CI.
  if (!write && stale > 0) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
