#!/usr/bin/env tsx
/**
 * Reflexion Loop CLI — the cross-repo entry point.
 *
 *   rtk run reflexion-loop -- "Add token-bucket rate limiting to the public API"
 *   npx tsx scripts/reflexion-loop.ts --brief-file ticket.md --repo . --max 3
 *
 * Generator = Gemini, Critic + Adjudicator = Claude (keys from the environment:
 * GEMINI_API_KEY + ANTHROPIC_API_KEY). Writes plan.md, critique.json and a
 * dependency-free SVG diminishing-returns chart. Exit code 0 = passed,
 * 2 = hit the revision cap without passing (handy in CI).
 *
 * Relative imports (matching scripts/migrate-analytics.ts) so it runs under tsx
 * without the '@/' path alias.
 */
import * as fs from 'fs';
import * as path from 'path';

import { runReflexion, type ReflexionResult } from '../src/lib/ai/reflexion/engine';
import { runnerFromEnv } from '../src/lib/ai/reflexion/providers-env';

const STACK_FILES = [
  'package.json',
  'tsconfig.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
];

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readStack(repo: string, maxCharsPerFile = 1800): string {
  const chunks: string[] = [];
  for (const f of STACK_FILES) {
    const p = path.join(repo, f);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      const text = fs.readFileSync(p, 'utf-8').slice(0, maxCharsPerFile);
      chunks.push(`### ${f}\n\`\`\`\n${text}\n\`\`\``);
    }
  }
  return chunks.slice(0, 8).join('\n\n');
}

/** Hand-rolled SVG line chart — zero dependencies, renders anywhere. */
function svgChart(scores: number[], threshold: number): string {
  const W = 480, H = 300, pad = 40;
  const n = Math.max(scores.length - 1, 1);
  const x = (i: number) => pad + (i / n) * (W - 2 * pad);
  const y = (s: number) => H - pad - (s / 10) * (H - 2 * pad);
  const pts = scores.map((s, i) => `${x(i)},${y(s)}`).join(' ');
  const dots = scores
    .map((s, i) => `<circle cx="${x(i)}" cy="${y(s)}" r="4" fill="#6366f1"/>`)
    .join('');
  const thY = y(threshold);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="sans-serif" font-size="12">
  <rect width="${W}" height="${H}" fill="white"/>
  <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#9ca3af"/>
  <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H - pad}" stroke="#9ca3af"/>
  <line x1="${pad}" y1="${thY}" x2="${W - pad}" y2="${thY}" stroke="#ef4444" stroke-dasharray="4"/>
  <text x="${W - pad}" y="${thY - 4}" text-anchor="end" fill="#ef4444">pass ${threshold}</text>
  <polyline points="${pts}" fill="none" stroke="#6366f1" stroke-width="2"/>
  ${dots}
  <text x="${W / 2}" y="${H - 8}" text-anchor="middle" fill="#374151">Revision</text>
  <text x="14" y="${H / 2}" text-anchor="middle" fill="#374151" transform="rotate(-90 14 ${H / 2})">Score /10</text>
</svg>`;
}

async function main(): Promise<number> {
  const briefFile = arg('--brief-file');
  const positional = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const brief = briefFile ? fs.readFileSync(briefFile, 'utf-8').trim() : positional?.trim();
  if (!brief) {
    console.error('Usage: reflexion-loop "<brief>" [--repo .] [--max 3] [--threshold 8] [--out .reflexion-out]');
    return 1;
  }

  const repo = arg('--repo') || '.';
  const maxRevisions = Number(arg('--max') || 3);
  const passThreshold = Number(arg('--threshold') || 8);
  const out = arg('--out') || '.reflexion-out';

  const runner = runnerFromEnv();
  console.error(`[reflexion] creator=${runner.models.creator} critic=${runner.models.critic}`);

  const result: ReflexionResult = await runReflexion(
    runner,
    { brief, stack: readStack(repo), maxRevisions, passThreshold },
    (e) => {
      if (e.phase === 'scored') {
        const c = e.critique;
        console.error(
          `[reflexion] rev ${e.revision}: ${c.score}/10 ` +
            `[gstack ${c.gstackDiagnosis} | atomic ${c.atomicBatches} | ethos ${c.productionEthos} | web ${c.modernWeb}] passed=${c.passed}`
        );
      }
    }
  );

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'plan.md'), result.rounds.at(-1)?.draft ?? '');
  fs.writeFileSync(path.join(out, 'ide-prompt.md'), result.idePrompt);
  fs.writeFileSync(path.join(out, 'critique.json'), JSON.stringify(result, null, 2));
  if (result.scores.length >= 2) {
    fs.writeFileSync(path.join(out, 'diminishing-returns.svg'), svgChart(result.scores, passThreshold));
  }

  console.log('\n' + '='.repeat(56));
  console.log(`Scores per revision : ${JSON.stringify(result.scores)}`);
  console.log(`Final score         : ${result.finalScore}/10  passed=${result.finalPassed}`);
  console.log(`Revisions used      : ${result.revisionsUsed}/${maxRevisions}`);
  console.log('-'.repeat(56));
  console.log('ADJUDICATOR VERDICT:\n' + result.verdict);
  console.log('-'.repeat(56));
  console.log(`Artifacts written to: ${path.resolve(out)}`);
  console.log(`  plan.md · ide-prompt.md · critique.json${result.scores.length >= 2 ? ' · diminishing-returns.svg' : ''}`);
  console.log('='.repeat(56));

  return result.finalPassed ? 0 : 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[reflexion] error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
