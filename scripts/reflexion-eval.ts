import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import { CRITIC_SYSTEM } from '../src/lib/ai/reflexion/prompts';
import { CritiqueSchema, type Critique } from '../src/lib/ai/reflexion/schema';

// This is the critic side of runnerFromEnv, minimally exported to only require ANTHROPIC_API_KEY
function buildCriticRunner() {
  const claudeKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!claudeKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set (needed for the Claude critic).'
    );
  }
  const anthropic = createAnthropic({ apiKey: claudeKey });
  // Default to claude-sonnet-4-6 as per MODELS.CLAUDE
  const criticModel = process.env.REFLEXION_CRITIC_MODEL || 'claude-sonnet-4-6';

  return {
    async critique(plan: string): Promise<Critique> {
      const { object } = await generateObject({
        model: anthropic(criticModel),
        schema: CritiqueSchema,
        system: CRITIC_SYSTEM,
        prompt: `Please critique this plan:\n\n${plan}`,
      });
      return object;
    },
  };
}

interface ExpectedResult {
  passed: boolean;
  maxOverallScore?: number;
  pillarBelow?: Record<string, number>;
  fixMustMentionAnyOf?: string[];
}

interface FrontMatter {
  id: string;
  title: string;
  class: string;
  expected: ExpectedResult;
}

interface EvalCase {
  file: string;
  frontmatter: FrontMatter;
  plan: string;
}

interface EvalResult {
  id: string;
  title: string;
  class: string;
  expected: ExpectedResult;
  actual: Critique;
  success: boolean;
  errors: string[];
}

export function evaluateCritique(
  expected: ExpectedResult,
  actual: Critique
): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  if (actual.passed !== expected.passed) {
    errors.push(
      `Expected passed=${expected.passed}, got passed=${actual.passed}`
    );
  }

  if (
    expected.maxOverallScore !== undefined &&
    actual.score > expected.maxOverallScore
  ) {
    errors.push(
      `Expected max score ${expected.maxOverallScore}, got ${actual.score}`
    );
  }

  if (expected.pillarBelow) {
    for (const [pillar, maxScore] of Object.entries(expected.pillarBelow)) {
      const actualScore = actual[pillar as keyof Critique] as number;
      if (actualScore > maxScore) {
        errors.push(
          `Expected pillar ${pillar} <= ${maxScore}, got ${actualScore}`
        );
      }
    }
  }

  if (expected.fixMustMentionAnyOf && expected.fixMustMentionAnyOf.length > 0) {
    const fixText = actual.actionableFix.toLowerCase();
    const mentioned = expected.fixMustMentionAnyOf.some((keyword) =>
      fixText.includes(keyword.toLowerCase())
    );
    if (!mentioned) {
      errors.push(
        `Expected actionableFix to mention one of [${expected.fixMustMentionAnyOf.join(', ')}], got: "${actual.actionableFix}"`
      );
    }
  }

  return { success: errors.length === 0, errors };
}

function isProviderBillingOrQuotaError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const statusCode =
    typeof err === 'object' && err !== null && 'statusCode' in err
      ? (err as { statusCode: unknown }).statusCode
      : undefined;
  const data =
    typeof err === 'object' && err !== null && 'data' in err
      ? (err as { data: unknown }).data
      : undefined;
  const dataError =
    typeof data === 'object' && data !== null && 'error' in data
      ? (data as { error: unknown }).error
      : undefined;
  const dataMsg =
    typeof dataError === 'object' && dataError !== null && 'message' in dataError
      ? String((dataError as { message: unknown }).message).toLowerCase()
      : '';

  return (
    statusCode === 402 ||
    msg.includes('credit balance') ||
    msg.includes('too low to access') ||
    msg.includes('plans & billing') ||
    msg.includes('insufficient_quota') ||
    dataMsg.includes('credit balance') ||
    dataMsg.includes('too low to access') ||
    dataMsg.includes('plans & billing')
  );
}

async function main() {
  const args = process.argv.slice(2);
  let caseToRun = '';
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--case') {
      caseToRun = args[i + 1];
      i++;
    } else if (args[i] === '--json') {
      jsonOutput = true;
    }
  }

  const plansDir = path.join(__dirname, '..', 'defect-library', 'plans');
  const files = fs.readdirSync(plansDir).filter((f) => f.endsWith('.md'));

  const cases: EvalCase[] = [];
  for (const file of files) {
    const filePath = path.join(plansDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);

    if (caseToRun && parsed.data.id !== caseToRun) {
      continue;
    }

    cases.push({
      file,
      frontmatter: parsed.data as FrontMatter,
      plan: parsed.content,
    });
  }

  if (cases.length === 0) {
    console.error('No cases found to evaluate.');
    process.exit(1);
  }

  const criticRunner = buildCriticRunner();
  const results: EvalResult[] = [];
  let allSuccess = true;

  for (const evalCase of cases) {
    if (!jsonOutput) {
      console.log(
        `Evaluating ${evalCase.frontmatter.id} - ${evalCase.frontmatter.title}...`
      );
    }

    let critique: Critique;
    try {
      critique = await criticRunner.critique(evalCase.plan);
    } catch (err: unknown) {
      if (isProviderBillingOrQuotaError(err)) {
        const errorDetail = err instanceof Error ? err.message : String(err);
        console.warn(
          `\n⚠️  [reflexion-eval] Anthropic API credit balance exhausted or quota reached: ${errorDetail}`
        );
        console.warn(
          '⚠️  Skipping evaluation harness without failing CI. Please top up API credits on the Anthropic Console to re-enable evaluation.\n'
        );
        process.exit(0);
      }
      throw err;
    }

    const evaluation = evaluateCritique(
      evalCase.frontmatter.expected,
      critique
    );

    if (!evaluation.success) {
      allSuccess = false;
    }

    results.push({
      id: evalCase.frontmatter.id,
      title: evalCase.frontmatter.title,
      class: evalCase.frontmatter.class,
      expected: evalCase.frontmatter.expected,
      actual: critique,
      success: evaluation.success,
      errors: evaluation.errors,
    });
  }

  const reportPath = path.join(
    __dirname,
    '..',
    'defect-library',
    'report.json'
  );
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('\n--- Evaluation Summary ---\n');
    console.log('| ID | Title | Class | Passed Eval? | Errors |');
    console.log('|---|---|---|---|---|');
    for (const result of results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const errStr = result.errors.length > 0 ? result.errors.join('; ') : '-';
      console.log(
        `| ${result.id} | ${result.title} | ${result.class} | ${status} | ${errStr} |`
      );
    }
    console.log(`\nReport written to ${reportPath}`);
  }

  process.exit(allSuccess ? 0 : 1);
}

// Only run main if executed directly
if (require.main === module) {
  main().catch((err) => {
    if (isProviderBillingOrQuotaError(err)) {
      const errorDetail = err instanceof Error ? err.message : String(err);
      console.warn(
        `\n⚠️  [reflexion-eval] Anthropic API credit balance exhausted: ${errorDetail}`
      );
      process.exit(0);
    }
    console.error(err);
    process.exit(1);
  });
}
