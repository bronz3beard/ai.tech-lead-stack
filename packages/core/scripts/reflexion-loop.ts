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

import {
  resumeReflexion,
  runReflexion,
  type ReflexionResult,
} from '../src/lib/ai/reflexion/engine';
import { runnerFromEnv } from '../src/lib/ai/reflexion/providers-env';
import { Answers, ReflexionStateV2 } from '../src/lib/ai/reflexion/schema';
import { FileStateStore } from '../src/lib/ai/reflexion/state-store';
import { assessTask, enforceTier, type Tier } from '../src/lib/ai/tier-policy';
import { langfuseSink } from '../src/lib/langfuse-sink';
import { formatInterviewMd, parseYamlAnswers } from './reflexion-loop-utils';

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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
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
  const W = 480,
    H = 300,
    pad = 40;
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

async function handleInteractive(state: ReflexionStateV2): Promise<Answers> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> =>
    new Promise((resolve) => readline.question(query, resolve));

  console.log('\n--- INTERACTIVE MODE ---');
  const questions = state.interview?.questions || [];
  const answers: Answers = { runId: state.runId, decisions: [] };

  for (const q of questions) {
    console.log(`\nQuestion: ${q.question}`);
    console.log(`Target: ${q.target} '${q.ref}'`);
    console.log(`Why: ${q.why}`);
    const ans = await question('> ');
    if (ans.trim() === '/approve') {
      answers.directive = 'approve';
      readline.close();
      return answers;
    }
    if (ans.trim() === '/stop') {
      answers.directive = 'stop';
      readline.close();
      return answers;
    }
    answers.decisions.push({ id: q.id, answer: ans.trim() });
  }

  readline.close();
  return answers;
}

async function main(): Promise<number> {
  const resumeArg = arg('--resume');
  const answersArg = arg('--answers');
  const isInteractive = hasFlag('--interactive');
  const autoMode = hasFlag('--auto');

  const repo = arg('--repo') || '.';
  const maxRevisions = Number(arg('--max') || 3);
  const passThreshold = Number(arg('--threshold') || 8);
  const tier = arg('--tier') as Tier | undefined;
  const maxCostUsd = tier === 'local' ? undefined : (arg('--max-cost-usd')
    ? Number(arg('--max-cost-usd'))
    : undefined);
  const maxTokens = arg('--max-tokens')
    ? Number(arg('--max-tokens'))
    : undefined;
  const maxWallClockMs = arg('--max-wallclock-ms')
    ? Number(arg('--max-wallclock-ms'))
    : (tier === 'local' && process.env.REFLEXION_MAX_WALLCLOCK_MS ? Number(process.env.REFLEXION_MAX_WALLCLOCK_MS) : undefined);
  const focus = arg('--focus') ? arg('--focus')!.split(',') : undefined;
  
  const sizeScore = arg('--size-score') ? Number(arg('--size-score')) : 0;
  const riskSignals = arg('--risk-signals') ? arg('--risk-signals')!.split(',') : [];

  // Let --out default to .reflexion-out unless resuming from a specific dir
  let outDir = arg('--out') || '.reflexion-out';
  let runIdToResume: string | undefined;

  if (resumeArg) {
    if (fs.existsSync(resumeArg) && fs.statSync(resumeArg).isDirectory()) {
      outDir = resumeArg;
    } else {
      runIdToResume = resumeArg;
      // Assume the default outDir if they just passed a runId
    }
  }

  const stateStore = new FileStateStore(outDir);
  const runner = runnerFromEnv();
  console.error(
    `[reflexion] creator=${runner.models.creator} critic=${runner.models.critic}`
  );

  let result: ReflexionResult;

  if (resumeArg) {
    const state = await stateStore.load(runIdToResume || 'default');
    if (!state) {
      console.error(`[reflexion] No state found in ${outDir} to resume.`);
      return 1;
    }

    let answers: Answers;

    if (isInteractive) {
      answers = await handleInteractive(state);
    } else if (answersArg) {
      const answersText =
        answersArg === '-'
          ? fs.readFileSync(0, 'utf-8')
          : fs.readFileSync(answersArg, 'utf-8');
      answers = parseYamlAnswers(answersText);
    } else {
      console.error(
        '[reflexion] --resume requires --answers <file|-> or --interactive.'
      );
      return 1;
    }

    result = await resumeReflexion(
      runner,
      state,
      answers,
      {
        brief: state.brief,
        stack: readStack(repo),
        maxRevisions: state.params.maxRevisions,
        passThreshold: state.params.passThreshold,
        budget: { maxCostUsd, maxTotalTokens: maxTokens, maxWallClockMs },
        focusPillars: focus,
        stateStore,
      },
      (e) => {
        if (e.phase === 'scored' && e.critique) {
          const c = e.critique;
          console.error(
            `[reflexion] rev ${e.revision}: ${c.score}/10 ` +
              `[gstack ${c.gstackDiagnosis} | atomic ${c.atomicBatches} | ethos ${c.productionEthos} | web ${c.modernWeb}] passed=${c.passed}`
          );
        } else {
          console.error(`[reflexion] phase: ${e.phase}`);
        }
      }
    );
  } else {
    const briefFile = arg('--brief-file');
    const fileArg = arg('--file');

    let positional: string | undefined;
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const flag = args[i];
        if (
          [
            '--brief-file',
            '--file',
            '--repo',
            '--max',
            '--threshold',
            '--max-cost-usd',
            '--max-tokens',
            '--max-wallclock-ms',
            '--focus',
            '--out',
            '--resume',
            '--answers',
            '--tier',
            '--size-score',
            '--risk-signals',
          ].includes(flag)
        ) {
          i++; // skip its value
        }
      } else {
        positional = args[i];
        break;
      }
    }

    let brief: string | undefined;
    if (fileArg) {
      brief = fs.readFileSync(fileArg, 'utf-8'); // read verbatim
    } else if (briefFile) {
      brief = fs.readFileSync(briefFile, 'utf-8').trim();
    } else {
      brief = positional?.trim();
    }

    if (!brief) {
      console.error(
        'Usage: reflexion-loop "<brief>" [--file <path>] [--repo .] [--max 3] [--threshold 8] [--out .reflexion-out]'
      );
      return 1;
    }

    if (tier && tier !== 'byo') {
      const assessment = assessTask({ sizeScore, riskSignals });
      const enforcement = enforceTier(tier, assessment);
      if (!enforcement.allowed) {
        console.error(`[reflexion] REFUSED by tier policy (${tier}): ${enforcement.reason}`);
        if (enforcement.escalateTo) {
          console.error(`[reflexion] -> Escalate to ${enforcement.escalateTo}`);
        }
        return 1; // Or another exit code? 1 is fine for error
      }
    }

    result = await runReflexion(
      runner,
      {
        brief,
        stack: readStack(repo),
        maxRevisions,
        passThreshold,
        mode: autoMode ? 'auto' : 'interview',
        budget: { maxCostUsd, maxTotalTokens: maxTokens, maxWallClockMs },
        focusPillars: focus,
        stateStore,
      },
      (e) => {
        if (e.phase === 'scored' && e.critique) {
          const c = e.critique;
          console.error(
            `[reflexion] rev ${e.revision}: ${c.score}/10 ` +
              `[gstack ${c.gstackDiagnosis} | atomic ${c.atomicBatches} | ethos ${c.productionEthos} | web ${c.modernWeb}] passed=${c.passed}`
          );
        } else {
          console.error(`[reflexion] phase: ${e.phase}`);
        }
      }
    );
  }

  // Determine exit code BEFORE writing artifacts
  let exitCode = 0;
  if (result.stopReason === 'passed' || result.stopReason === 'user-approve') {
    exitCode = 0;
  } else if (
    !result.stopReason &&
    result.interview &&
    result.interview.questions.length > 0
  ) {
    exitCode = 2; // parked
  } else if (
    result.stopReason === 'budget-exceeded' ||
    result.stopReason === 'user-stop' ||
    result.stopReason === 'wallclock-exceeded'
  ) {
    exitCode = 3;
  } else if (
    result.stopReason === 'refine-contract-violation' ||
    result.verdict === 'unknown'
  ) {
    exitCode = 4;
  } else {
    // If auto mode hits max-revisions, it doesn't pass. Could be considered exit 2 per v1, or 2 per v2 specs.
    // The spec says "2 phase 'AWAITING_ANSWERS' (parked)".
    // So max-revisions in auto mode should be 2 for failure to pass? Or 2 because it's not passed?
    // Let's stick to v1: exit 2 if hit revision cap without passing.
    exitCode = 2;
  }

  // Ensure output directory exists (state store saves it but just in case)
  fs.mkdirSync(outDir, { recursive: true });

  if (result.rounds.length > 0) {
    fs.writeFileSync(
      path.join(outDir, 'plan.md'),
      result.rounds.at(-1)?.draft ?? ''
    );
    fs.writeFileSync(
      path.join(outDir, 'critique.json'),
      JSON.stringify(result, null, 2)
    );
    if (result.scores.length >= 2) {
      fs.writeFileSync(
        path.join(outDir, 'diminishing-returns.svg'),
        svgChart(result.scores, passThreshold)
      );
    }
  }

  if (
    exitCode === 2 &&
    result.interview &&
    result.interview.questions.length > 0
  ) {
    fs.writeFileSync(
      path.join(outDir, 'interview.md'),
      formatInterviewMd(result.runId, result.interview.questions)
    );
  } else if (exitCode === 0) {
    fs.writeFileSync(path.join(outDir, 'ide-prompt.md'), result.idePrompt);
  }

  console.log('\n' + '='.repeat(56));
  if (result.criticDegraded) {
    console.log(
      '⚠️  WARNING: Critique ran in fallback mode (Gemini 3.1 Pro) because the Claude API was unavailable — model separation was reduced; review this plan with extra scrutiny.'
    );
    console.log('-'.repeat(56));
  }
  console.log(`Scores per revision : ${JSON.stringify(result.scores)}`);
  console.log(
    `Final score         : ${result.finalScore}/10  passed=${result.finalPassed}`
  );
  console.log(`Revisions used      : ${result.revisionsUsed}/${maxRevisions}`);
  console.log('-'.repeat(56));
  console.log('ADJUDICATOR VERDICT:\n' + result.verdict);
  console.log('-'.repeat(56));
  console.log(`Artifacts written to: ${path.resolve(outDir)}`);
  console.log(
    `  plan.md · critique.json${result.scores.length >= 2 ? ' · diminishing-returns.svg' : ''}${exitCode === 2 ? ' · interview.md' : ''}${exitCode === 0 ? ' · ide-prompt.md' : ''}`
  );
  console.log('='.repeat(56));

  return exitCode;
}

main()
  .then((code) => {
    langfuseSink.shutdown();
    process.exit(code);
  })
  .catch((err) => {
    console.error(
      '[reflexion] error:',
      err instanceof Error ? err.message : err
    );
    langfuseSink.shutdown();
    process.exit(4);
  });
