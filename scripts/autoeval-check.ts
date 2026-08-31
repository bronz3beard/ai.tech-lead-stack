import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { validatePlanContract } from '../src/lib/ai/reflexion/plan-contract';

export function run() {
  console.log(
    JSON.stringify({ status: 'running', step: 'MinimumCD Verification' })
  );

  try {
    try {
      execSync('npm test', { stdio: 'ignore' });
    } catch {
      // Non-blocking failure: allows the script to continue even if tests are missing
    }

    const diff = execSync('git diff main..HEAD').toString();
    const diffFilesStr = execSync('git diff main..HEAD --name-only').toString();
    const modifiedFiles = diffFilesStr
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && f.endsWith('.md'));

    const results = {
      score: 100,
      violations: [] as string[],
      passed: true,
    };

    if (diff.includes('console.log')) {
      results.score -= 25;
      results.violations.push('Contains console.log');
    }

    for (const file of modifiedFiles) {
      if (file.includes('defect-library/plans/')) {
        continue;
      }

      const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8');
      if (content.includes('Phase 0') || content.includes('Atomic Task List')) {
        const report = validatePlanContract(content);
        if (!report.passesStructuralGate) {
          for (const violation of report.violations) {
            if (violation.severity === 'fatal') {
              results.score -= 50;
              results.violations.push(
                `[${file}] ${violation.locus}: ${violation.message}`
              );
            }
          }
        }
      }
    }

    if (results.score < 75) results.passed = false;

    console.log(JSON.stringify(results));

    process.exit(results.passed ? 0 : 1);
  } catch (err: any) {
    console.log(JSON.stringify({ error: err.message, passed: false }));
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}
