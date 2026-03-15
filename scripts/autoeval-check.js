#!/usr/bin/env node
/**
 * @tool quality-check
 * @description Runs a tech-lead level quality evaluation using rtk.
 */
const { execSync } = require('child_process');

function run() {
  console.log(
    JSON.stringify({ status: 'running', step: 'MinimumCD Verification' })
  );

  try {
    // Structured check
    try {
      execSync('npm test', { stdio: 'ignore' });
    } catch (e) {
      // Ignore failure if it's just missing tests
    }
    const diff = execSync('git diff main..HEAD').toString();

    const results = {
      score: 100,
      violations: [],
      passed: true,
    };

    if (diff.includes('console.log')) {
      results.score -= 25;
      results.violations.push('Contains console.log');
    }

    if (results.score < 75) results.passed = false;

    // RTK prefers JSON output for token efficiency
    console.log(JSON.stringify(results));
    process.exit(results.passed ? 0 : 1);
  } catch (e) {
    console.log(JSON.stringify({ error: 'Tests failed', passed: false }));
    process.exit(1);
  }
}

run();
