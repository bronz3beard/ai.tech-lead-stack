#!/usr/bin/env node
/**
 * @file resolve-labels.mjs
 * @description Resolves, maps, and applies labels to a PR deterministically based on diff.
 */

import { execSync } from 'child_process';

const originalLog = console.log;
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

// Normalise labels for matching (lowercase, strip 'type:'/'area:' prefix, collapse dash/underscore/space)
const normalise = (l) =>
  l
    .toLowerCase()
    .replace(/^(type|area):?\s*/, '')
    .replace(/[-_\s]+/g, '');

const SYNONYMS = {
  bug: ['bug', 'defect'],
  enhancement: ['enhancement', 'feature'],
  chore: ['chore', 'maintenance', 'build', 'ci'],
  documentation: ['documentation', 'docs'],
  refactor: ['refactor'],
  test: ['test'],
  performance: ['performance', 'perf'],
  database: ['database', 'db'],
  skills: ['skills', 'agent'],
  ui: ['ui', 'frontend'],
  dependencies: ['dependencies', 'deps'],
  nouiimpact: ['no-ui-impact'],
};

export function classifyDiff({ files, commitSubjects, hasUiChange }) {
  const concepts = new Set();

  // Rules by subject
  for (const subject of commitSubjects) {
    if (subject.startsWith('fix:')) concepts.add('bug');
    else if (subject.startsWith('feat:')) concepts.add('enhancement');
    else if (subject.startsWith('docs:')) concepts.add('documentation');
    else if (
      subject.startsWith('chore:') ||
      subject.startsWith('build:') ||
      subject.startsWith('ci:')
    )
      concepts.add('chore');
    else if (subject.startsWith('refactor:')) concepts.add('refactor');
    else if (subject.startsWith('test:')) concepts.add('test');
    else if (subject.startsWith('perf:')) concepts.add('performance');
  }

  // Rules by path
  let hasDocs = false;
  let hasDeps = false;
  let hasOther = false;

  for (const f of files) {
    if (f.startsWith('prisma/migrations/')) concepts.add('database');
    if (f.startsWith('.github/workflows/')) concepts.add('chore');
    if (f.includes('.test.') || f.includes('__tests__')) concepts.add('test');
    if (f.startsWith('.ai/skills/') || f.startsWith('.agents/'))
      concepts.add('skills');

    if (f.endsWith('.md')) {
      hasDocs = true;
    } else if (f.endsWith('package.json') || f.endsWith('pnpm-lock.yaml')) {
      hasDeps = true;
    } else {
      hasOther = true;
    }
  }

  if (hasDocs && !hasOther) concepts.add('documentation');
  if (hasDeps && !hasOther) concepts.add('dependencies');

  if (hasUiChange) {
    concepts.add('ui');
  } else {
    concepts.add('nouiimpact');
  }

  return Array.from(concepts);
}

function getRepoLabels() {
  try {
    const raw = execSync('gh label list --limit 200 --json name', {
      encoding: 'utf-8',
    });
    return JSON.parse(raw).map((l) => l.name);
  } catch (err) {
    console.error('Failed to fetch repo labels:', err.message);
    return [];
  }
}

function createLabel(name) {
  try {
    // Generate a random hex colour
    const color = Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0');
    execSync(`gh label create "${name}" --color ${color} --force`, {
      encoding: 'utf-8',
    });
    return true;
  } catch (err) {
    console.error(`Failed to create label ${name}:`, err.message);
    return false;
  }
}

function main() {
  const prNumber = process.argv[2];
  const createMissingLabels = process.argv.includes('--create-missing');

  if (!prNumber) {
    console.error('PR number/URL argument missing.');
    process.exit(1);
  }

  // Gather diff context (simplified for this script's scope, real usage would parse git properly or take it as args)
  let files = [];
  let commitSubjects = [];
  try {
    files = execSync(
      'gh pr view ' + prNumber + ' --json files -q ".files[].path"',
      { encoding: 'utf-8' }
    )
      .trim()
      .split('\n');
    commitSubjects = execSync(
      'gh pr view ' +
        prNumber +
        ' --json commits -q ".commits[].messageHeadline"',
      { encoding: 'utf-8' }
    )
      .trim()
      .split('\n');
  } catch (e) {
    console.warn('Could not fetch PR details, skipping label resolution.');
    process.exit(0);
  }

  const hasUiChange = files.some(
    (f) => f.match(/\.(tsx|jsx|css|scss)$/) || f.includes('tailwind.config')
  );

  const concepts = classifyDiff({ files, commitSubjects, hasUiChange });
  const repoLabels = getRepoLabels();
  const repoLabelsNormalised = repoLabels.reduce((acc, lbl) => {
    acc[normalise(lbl)] = lbl;
    return acc;
  }, {});

  const matchedLabels = [];
  const createdLabels = [];
  const droppedLabels = [];

  for (const concept of concepts) {
    const syns = SYNONYMS[concept] || [concept];
    let found = false;
    for (const syn of syns) {
      const match = repoLabelsNormalised[normalise(syn)];
      if (match) {
        matchedLabels.push(match);
        found = true;
        break;
      }
    }

    if (!found) {
      if (createMissingLabels) {
        const preferredName =
          syns[0] === 'nouiimpact' ? 'no-ui-impact' : syns[0];
        if (createLabel(preferredName)) {
          matchedLabels.push(preferredName);
          createdLabels.push(preferredName);
        } else {
          droppedLabels.push(syns[0]);
        }
      } else {
        droppedLabels.push(syns[0]);
      }
    }
  }

  // Cap at 5
  const labelsToApply = matchedLabels.slice(0, 5);

  if (labelsToApply.length > 0) {
    try {
      execSync(
        `gh pr edit ${prNumber} ${labelsToApply.map((l) => `--add-label "${l}"`).join(' ')}`,
        { encoding: 'utf-8' }
      );

      // Verification via read back
      const actualLabels = execSync(
        `gh pr view ${prNumber} --json labels -q ".labels[].name"`,
        { encoding: 'utf-8' }
      )
        .trim()
        .split('\n');
      const applied = labelsToApply.filter((l) => actualLabels.includes(l));
      const failed = labelsToApply.filter((l) => !actualLabels.includes(l));

      process.stdout.write(
        JSON.stringify(
          {
            status: 'success',
            applied,
            created: createdLabels,
            dropped: droppedLabels.concat(failed),
          },
          null,
          2
        ) + '\n'
      );
    } catch (err) {
      console.error('Failed to apply labels to PR:', err.message);
      process.exit(0);
    }
  } else {
    process.stdout.write(
      JSON.stringify(
        {
          status: 'success',
          applied: [],
          created: [],
          dropped: droppedLabels,
        },
        null,
        2
      ) + '\n'
    );
  }
}

// Ignore execution if imported for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
