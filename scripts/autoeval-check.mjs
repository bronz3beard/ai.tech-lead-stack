#!/usr/bin/env node
/**
 * @file autoeval-check.mjs
 * @description Wrapper script for autoeval-check.ts to maintain CLI compatibility.
 */
import { execSync } from 'child_process';

function run() {
  try {
    const output = execSync('npx tsx scripts/autoeval-check.ts', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    console.log(output);
  } catch (err) {
    if (err.stdout) {
      console.log(err.stdout);
    }
    process.exit(err.status ?? 1);
  }
}

run();
