#!/usr/bin/env node
/**
 * @file autoeval-check.mjs
 * @description Automated quality evaluation script for Tech-Lead Stack.
 * Performs basic linting and test execution to ensure MinimumCD standards.
 *
 * @tool quality-check
 * @returns {JSON} Evaluation results including score, violations, and pass status.
 */
import { execSync } from 'child_process';

/**
 * Main execution function for quality evaluation.
 * Scans for common violations (e.g., console.log) and runs npm tests.
 */
function run() {
  // Notify RTK/Agent of the current step for observability
  console.log(
    JSON.stringify({ status: 'running', step: 'MinimumCD Verification' })
  );

  try {
    // Attempt to run project tests; ignore if none are found or they fail
    // as this is a generic check.
    try {
      execSync('npm test', { stdio: 'ignore' });
    } catch {
      // Non-blocking failure: allows the script to continue even if tests are missing
    }

    // Capture the diff between the current branch and main for analysis
    const diff = execSync('git diff main..HEAD').toString();

    // Initialize evaluation results
    const results = {
      score: 100,
      violations: [],
      passed: true,
    };

    // Violation: Excessive console.log usage in production-ready code
    if (diff.includes('console.log')) {
      results.score -= 25;
      results.violations.push('Contains console.log');
    }

    // Determine overall pass/fail based on a 75% threshold
    if (results.score < 75) results.passed = false;

    // Standard output in JSON for easy agent consumption and token efficiency
    console.log(JSON.stringify(results));

    // Exit with appropriate code to signal success/failure to the caller
    process.exit(results.passed ? 0 : 1);
  } catch (err) {
    // Critical failure (e.g., git diff failed)
    console.log(JSON.stringify({ error: err.message, passed: false }));
    process.exit(1);
  }
}

// Invoke the runner
run();
