/**
 *
 * Per-skill estimate accuracy is not enough: the orchestrator sums estimates
 * across a chain and decides whether to proceed or warn, so errors can compound
 * or cancel. This measures accuracy at the PLAN level — one "plan" = all the
 * AnalyticsEvents sharing a loopRunId (fallback: projectName + day bucket).
 *
 * For each plan it computes:
 *   estimated_total = sum of frontmatter estimates for the skills in the plan
 *   observed_total  = sum of AnalyticsEvent.totalTokens for the plan
 *   error%          = (observed - estimated) / estimated
 * Then reports the worst plans and an aggregate (mean abs error, over/under split).
 * That aggregate is the number that tells you whether your "budget gate"
 * threshold is trustworthy or theatre.
 *
 * Run:
 *   npx tsx scripts/replay-plan-budgets.ts
 *   npx tsx scripts/replay-plan-budgets.ts --group project --top 15
 *
 * RELATIVE imports only (tsx). prisma self-loads .env.
 */
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';

import { prisma } from '../src/lib/prisma';
import { normalizeSkillName } from '../src/lib/trace-utils';

const SKILL_DIRS = ['.ai/skills', '.ai/pm-skills'];

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** name(normalized) -> estimated tokens */
function loadEstimates(): Map<string, number> {
  const map = new Map<string, number>();
  for (const dir of SKILL_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const parsed = matter(fs.readFileSync(path.join(dir, f), 'utf-8'));
      const raw = (parsed.data.name as string) || f.replace(/\.md$/, '');
      const m = String(parsed.data.cost ?? '').match(/~\s*([0-9]+)\s+tokens/);
      if (m) map.set(normalizeSkillName(raw), Number(m[1]));
    }
  }
  return map;
}

interface Plan {
  key: string;
  skills: string[];
  estimated: number;
  observed: number;
  missingEstimates: string[];
}

async function main() {
  const groupBy = (arg('--group') ?? 'run') as 'run' | 'project';
  const top = Number(arg('--top') ?? 12);
  const estimates = loadEstimates();

  const rows = await prisma.analyticsEvent.findMany({
    where: { status: 'SUCCESS', totalTokens: { gt: 0 } },
    select: {
      skillName: true,
      totalTokens: true,
      loopRunId: true,
      projectName: true,
      createdAt: true,
    },
  });

  const groups = new Map<string, Plan>();
  for (const r of rows) {
    if (!r.skillName || r.totalTokens == null) continue;
    const key =
      groupBy === 'project'
        ? `${r.projectName ?? 'unknown'}@${r.createdAt.toISOString().slice(0, 10)}`
        : (r.loopRunId ?? '');
    if (!key) continue; // skip un-grouped rows when replaying by run
    const skill = normalizeSkillName(r.skillName);
    const est = estimates.get(skill);
    const plan =
      groups.get(key) ??
      groups
        .set(key, {
          key,
          skills: [],
          estimated: 0,
          observed: 0,
          missingEstimates: [],
        })
        .get(key)!;
    plan.skills.push(skill);
    plan.observed += r.totalTokens;
    if (est == null) plan.missingEstimates.push(skill);
    else plan.estimated += est;
  }

  const plans = [...groups.values()].filter((p) => p.estimated > 0);
  if (plans.length === 0) {
    console.log(
      'No multi-skill plans found for grouping =',
      groupBy,
      '(need loopRunId-tagged events).'
    );
    await prisma.$disconnect();
    return;
  }

  for (const p of plans)
    (p as any).errorPct = (p.observed - p.estimated) / p.estimated;
  plans.sort(
    (a, b) => Math.abs((b as any).errorPct) - Math.abs((a as any).errorPct)
  );

  console.log(`\nPLAN-LEVEL BUDGET REPLAY (grouped by ${groupBy})\n`);
  console.log(
    'plan'.padEnd(30),
    'skills'.padStart(7),
    'est'.padStart(8),
    'obs'.padStart(8),
    'cached'.padStart(8),
    'error'.padStart(8)
  );
  console.log('-'.repeat(80));
  for (const p of plans.slice(0, top)) {
    const err = (p as any).errorPct as number;
    console.log(
      p.key.slice(0, 28).padEnd(30),
      String(p.skills.length).padStart(7),
      String(p.estimated).padStart(8),
      String(p.observed).padStart(8),
      String((p as any).cached || 0).padStart(8),
      `${(err * 100).toFixed(0)}%`.padStart(8)
    );
  }

  const errs = plans.map((p) => Math.abs((p as any).errorPct));
  const meanAbs = errs.reduce((s, v) => s + v, 0) / errs.length;
  const over = plans.filter((p) => (p as any).errorPct > 0).length;
  const totalMissing = new Set(plans.flatMap((p) => p.missingEstimates)).size;

  console.log('\nAggregate:');
  console.log(`  plans analysed:            ${plans.length}`);
  console.log(`  mean |error| vs estimate:  ${(meanAbs * 100).toFixed(1)}%`);
  console.log(
    `  under-budgeted plans:      ${over}/${plans.length} (observed > estimated)`
  );
  if (totalMissing)
    console.log(
      `  skills seen with NO estimate: ${totalMissing} (add a cost: line to these)`
    );
  console.log(
    '\n  → If mean |error| is high, your orchestrator proceed/warn gate is not trustworthy yet.'
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
