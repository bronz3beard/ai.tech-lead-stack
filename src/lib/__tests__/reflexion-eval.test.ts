import { evaluateCritique } from '../../../scripts/reflexion-eval';
import type { Critique } from '../ai/reflexion/schema';

describe('reflexion-eval logic', () => {
  const baseCritique: Critique = {
    gstackDiagnosis: 8,
    atomicBatches: 8,
    productionEthos: 8,
    modernWeb: 8,
    score: 8,
    passed: false,
    actionableFix: 'Please slice the tasks smaller.',
  };

  it('passes when actual matches expected (golden pass)', () => {
    const expected = { passed: true };
    const actual = { ...baseCritique, passed: true, actionableFix: '' };
    const result = evaluateCritique(expected, actual);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails if passed status does not match', () => {
    const expected = { passed: true };
    const actual = { ...baseCritique, passed: false };
    const result = evaluateCritique(expected, actual);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Expected passed=true, got passed=false');
  });

  it('fails if overall score exceeds maxOverallScore', () => {
    const expected = { passed: false, maxOverallScore: 6 };
    const actual = { ...baseCritique, score: 7 };
    const result = evaluateCritique(expected, actual);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Expected max score 6, got 7');
  });

  it('passes if overall score is within maxOverallScore', () => {
    const expected = { passed: false, maxOverallScore: 6 };
    const actual = { ...baseCritique, score: 5 };
    const result = evaluateCritique(expected, actual);
    expect(result.success).toBe(true);
  });

  it('fails if a specific pillar score exceeds limit', () => {
    const expected = { passed: false, pillarBelow: { atomicBatches: 5 } };
    const actual = { ...baseCritique, atomicBatches: 6 };
    const result = evaluateCritique(expected, actual);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Expected pillar atomicBatches <= 5, got 6');
  });

  it('passes if specific pillar score is within limit', () => {
    const expected = { passed: false, pillarBelow: { atomicBatches: 5 } };
    const actual = { ...baseCritique, atomicBatches: 4 };
    const result = evaluateCritique(expected, actual);
    expect(result.success).toBe(true);
  });

  it('fails if actionableFix does not mention any required keywords', () => {
    const expected = { passed: false, fixMustMentionAnyOf: ['split', 'slice'] };
    const actual = { ...baseCritique, actionableFix: 'Please add more tests.' };
    const result = evaluateCritique(expected, actual);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Expected actionableFix to mention one of [split, slice], got: "Please add more tests."');
  });

  it('passes if actionableFix mentions a required keyword (case insensitive)', () => {
    const expected = { passed: false, fixMustMentionAnyOf: ['split', 'slice'] };
    const actual = { ...baseCritique, actionableFix: 'You need to SLICE this up.' };
    const result = evaluateCritique(expected, actual);
    expect(result.success).toBe(true);
  });
});
