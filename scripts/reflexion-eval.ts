import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { CRITIC_SYSTEM } from '../src/lib/ai/reflexion/prompts';
import { CritiqueSchema, type Critique } from '../src/lib/ai/reflexion/schema';

// This is the critic side of runnerFromEnv, minimally exported to only require ANTHROPIC_API_KEY
function buildCriticRunner() {
  const claudeKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!claudeKey) {
    throw new Error('ANTHROPIC_API_KEY is not set (needed for the Claude critic).');
  }
  const anthropic = createAnthropic({ apiKey: claudeKey });
  // Default to claude-3-5-sonnet-20240620 as per MODELS.CLAUDE
  const criticModel = process.env.REFLEXION_CRITIC_MODEL || 'claude-3-5-sonnet-20240620';

  return {
    async critique(plan: string): Promise<Critique> {
      const { object } = await generateObject({
        model: anthropic(criticModel),
        schema: CritiqueSchema,
        system: CRITIC_SYSTEM,
        prompt: `Please critique this plan:\n\n${plan}`,
      });
      return object;
    }
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

export function evaluateCritique(expected: ExpectedResult, actual: Critique): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  if (actual.passed !== expected.passed) {
    errors.push(`Expected passed=${expected.passed}, got passed=${actual.passed}`);
  }

  if (expected.maxOverallScore !== undefined && actual.score > expected.maxOverallScore) {
    errors.push(`Expected max score ${expected.maxOverallScore}, got ${actual.score}`);
  }

  if (expected.pillarBelow) {
    for (const [pillar, maxScore] of Object.entries(expected.pillarBelow)) {
      const actualScore = actual[pillar as keyof Critique] as number;
      if (actualScore > maxScore) {
        errors.push(`Expected pillar ${pillar} <= ${maxScore}, got ${actualScore}`);
      }
    }
  }

  if (expected.fixMustMentionAnyOf && expected.fixMustMentionAnyOf.length > 0) {
    const fixText = actual.actionableFix.toLowerCase();
    const mentioned = expected.fixMustMentionAnyOf.some(keyword => fixText.includes(keyword.toLowerCase()));
    if (!mentioned) {
      errors.push(`Expected actionableFix to mention one of [${expected.fixMustMentionAnyOf.join(', ')}], got: "${actual.actionableFix}"`);
    }
  }

  return { success: errors.length === 0, errors };
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
  const files = fs.readdirSync(plansDir).filter(f => f.endsWith('.md'));

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
      console.log(`Evaluating ${evalCase.frontmatter.id} - ${evalCase.frontmatter.title}...`);
    }

    const critique = await criticRunner.critique(evalCase.plan);
    const evaluation = evaluateCritique(evalCase.frontmatter.expected, critique);

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

  const reportPath = path.join(__dirname, '..', 'defect-library', 'report.json');
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
      console.log(`| ${result.id} | ${result.title} | ${result.class} | ${status} | ${errStr} |`);
    }
    console.log(`\nReport written to ${reportPath}`);
  }

  process.exit(allSuccess ? 0 : 1);
}

// Only run main if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
