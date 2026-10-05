import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { validatePlanContract } from './plan-contract';

describe('plan-contract validation', () => {
  const getPlanBody = (filename: string) => {
    const filePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      '..',
      'defect-library',
      'plans',
      filename
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    const { content: body } = matter(content);
    return body;
  };

  it('detects a big bang integration (DL-001)', () => {
    const body = getPlanBody('DL-001-big-bang.md');
    const report = validatePlanContract(body);

    expect(report.passesStructuralGate).toBe(false);
    
    // Should have a fatal error in atomicBatches
    const fatalAtomic = report.violations.find(
      (v) => v.pillar === 'atomicBatches' && v.severity === 'fatal'
    );
    expect(fatalAtomic).toBeDefined();
  });

  it('detects missing Phase 0 stack diagnosis (DL-003)', () => {
    const body = getPlanBody('DL-003-missing-phase-0.md');
    const report = validatePlanContract(body);

    expect(report.passesStructuralGate).toBe(false);
    
    const fatalGStack = report.violations.find(
      (v) => v.pillar === 'gstackDiagnosis' && v.severity === 'fatal'
    );
    expect(fatalGStack).toBeDefined();
  });

  it('detects fake verification (DL-005)', () => {
    const body = getPlanBody('DL-005-fake-verification.md');
    const report = validatePlanContract(body);

    expect(report.passesStructuralGate).toBe(false);

    const fatalProductionEthos = report.violations.find(
      (v) => v.pillar === 'productionEthos' && v.severity === 'fatal'
    );
    expect(fatalProductionEthos).toBeDefined();
  });

  it('warns on too many LOC (DL-006)', () => {
    const body = getPlanBody('DL-006-too-many-loc.md');
    const report = validatePlanContract(body);

    const warnAtomic = report.violations.find(
      (v) => v.pillar === 'atomicBatches' && v.severity === 'warn' && v.message.includes('100 LOC')
    );
    expect(warnAtomic).toBeDefined();
  });

  it('passes a golden plan (DL-007)', () => {
    const body = getPlanBody('DL-007-golden-pass.md');
    const report = validatePlanContract(body);

    expect(report.violations.filter(v => v.severity === 'fatal')).toHaveLength(0);
    expect(report.passesStructuralGate).toBe(true);
  });

  describe('verification steps that wrap across lines', () => {
    // Prettier's proseWrap (and LLM output) can break a task paragraph right
    // after "Verification:", leaving the command on the next line.
    const planWithTask = (task: string) => `## Phase 0 - Stack Diagnosis

Detected stack: Node.js (v22), Next.js (App Router), Prisma, Jest. I will follow
the existing \`src/lib/\` layout. \`npm run lint\` and \`npm test\` exist.

## Atomic Task List

1. ${task}

## Risks & Verification

- Risk: none beyond the task. Gate: \`npm test\` passes before the PR.
`;
    const verificationFatal = (task: string) =>
      validatePlanContract(planWithTask(task)).violations.find(
        (v) => v.pillar === 'productionEthos' && v.severity === 'fatal'
      );

    it('accepts a runnable command that starts on the line after "Verification:"', () => {
      const task = `Add \`formatCurrency\` in \`src/lib/currency.ts\` with tests in
   \`src/lib/__tests__/currency.test.ts\`. Why <100 LOC: one small file. Verification:
   \`npx jest currency && npm run lint\` passes.`;

      expect(verificationFatal(task)).toBeUndefined();
    });

    it('still rejects a fake verification phrase split across two lines', () => {
      // "run" alone satisfies the runnable-token check, so only matching the
      // wrapped "looks correct" catches this as fake.
      const task = `Add \`formatCurrency\` in \`src/lib/currency.ts\`. Why <100 LOC: one small
   file. Verification: run it locally and it looks
   correct in the browser.`;

      expect(verificationFatal(task)).toBeDefined();
    });
  });
});
