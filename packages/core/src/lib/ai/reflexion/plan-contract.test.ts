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
});
