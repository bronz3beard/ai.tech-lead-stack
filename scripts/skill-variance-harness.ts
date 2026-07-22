/**
 *
 * Mean cost hides risk: a skill averaging 1,200 tokens but swinging 400–4,000 is
 * dangerous to budget. This surfaces the coefficient of variation (CV = stdev/mean)
 * per skill so you know which ones are volatile.
 *
 * Two modes:
 *   A) DEFAULT (free, offline): "historical dispersion" from AnalyticsEvent.
 *      Uses real prior runs — but inputs varied, so treat high CV as "inputs
 *      swing this skill a lot", not as pure fixed-input variance.
 *        npx tsx scripts/skill-variance-harness.ts
 *        npx tsx scripts/skill-variance-harness.ts --min 15 --cv 0.4
 *
 *   B) LIVE (costs tokens): true fixed-input variance for the reflexion loop.
 *      Runs the SAME brief K times through runnerFromEnv().generate and measures
 *      token spread. Capped + prints an estimate before spending. Targets the
 *      reflexion generate() call (the expensive path that runs headless);
 *      arbitrary skills need the app runtime, so extend via the chat/skills path.
 *        npx tsx scripts/skill-variance-harness.ts --live --brief-file ticket.md --runs 5
 *
 * RELATIVE imports only (tsx). prisma self-loads .env.
 */
import fs from 'fs';

import { prisma } from '../src/lib/prisma';
import { normalizeSkillName } from '../src/lib/trace-utils';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (flag: string) => process.argv.includes(flag);

function stats(values: number[]) {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdev = Math.sqrt(variance);
  return {
    n,
    mean: Math.round(mean),
    stdev: Math.round(stdev),
    cv: mean ? stdev / mean : 0,
  };
}

async function offline() {
  const minSamples = Number(arg('--min') ?? 15);
  const cvFlag = Number(arg('--cv') ?? 0.4);

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

  const report = [...buckets.entries()]
    .filter(([, v]) => v.length >= minSamples)
    .map(([name, v]) => ({ name, ...stats(v) }))
    .sort((a, b) => b.cv - a.cv);

  console.log(
    `\nSKILL TOKEN DISPERSION (historical, min samples=${minSamples})\n`
  );
  console.log(
    'skill'.padEnd(38),
    'n'.padStart(5),
    'mean'.padStart(7),
    'stdev'.padStart(7),
    'CV'.padStart(7)
  );
  console.log('-'.repeat(74));
  for (const r of report) {
    const flag =
      r.cv >= cvFlag ? '  ⚠ volatile — budget with p95, not mean' : '';
    console.log(
      r.name.padEnd(38),
      String(r.n).padStart(5),
      String(r.mean).padStart(7),
      String(r.stdev).padStart(7),
      r.cv.toFixed(2).padStart(7),
      flag
    );
  }
  console.log(
    `\n${report.filter((r) => r.cv >= cvFlag).length} skill(s) above CV ${cvFlag}.`
  );
  await prisma.$disconnect();
}

async function live() {
  const runs = Math.min(Number(arg('--runs') ?? 5), 10); // hard cap to avoid runaway cost
  const briefFile = arg('--brief-file');
  if (!briefFile || !fs.existsSync(briefFile)) {
    throw new Error(
      '--live requires --brief-file <path> pointing at a brief/ticket.'
    );
  }
  const brief = fs.readFileSync(briefFile, 'utf-8');

  // Imported lazily so offline mode never needs model keys.
  const { runnerFromEnv } =
    await import('../src/lib/ai/reflexion/providers-env');
  const runner = runnerFromEnv();

  console.log(
    `\nLIVE fixed-input variance — creator=${runner.models.creator}, runs=${runs}`
  );
  console.log('This spends tokens. Ctrl-C within 3s to abort.\n');
  await new Promise((r) => setTimeout(r, 3000));

  const perRun: number[] = [];
  let priorCost = 0;
  for (let i = 1; i <= runs; i++) {
    await runner.generate(brief, 'Draft an implementation plan for the brief.');
    const usage = runner.getUsage();
    const runTokens = usage.tokens - perRun.reduce((s, v) => s + v, 0);
    perRun.push(runTokens);
    console.log(
      `  run ${i}: ${runTokens} tokens  (cumulative $${usage.costUsd.toFixed(4)})`
    );
    priorCost = usage.costUsd;
  }

  const s = stats(perRun);
  console.log('\nResult:');
  console.log(
    `  mean ${s.mean}  stdev ${s.stdev}  CV ${s.cv.toFixed(2)}  total cost $${priorCost.toFixed(4)}`
  );
  console.log(
    s.cv >= 0.25
      ? '  ⚠ high fixed-input variance — output length is unstable.'
      : '  ✓ stable.'
  );
}

(hasFlag('--live') ? live() : offline()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
