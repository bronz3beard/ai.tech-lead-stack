import { assessTask, enforceTier, deriveLoopParams } from '../tier-policy';

describe('Tier Policy', () => {
  describe('assessTask', () => {
    it('maps scores to sizes correctly', () => {
      expect(assessTask({ sizeScore: 1, riskSignals: [] }).size).toBe('XS');
      expect(assessTask({ sizeScore: 3, riskSignals: [] }).size).toBe('S');
      expect(assessTask({ sizeScore: 5, riskSignals: [] }).size).toBe('M');
      expect(assessTask({ sizeScore: 8, riskSignals: [] }).size).toBe('L');
      expect(assessTask({ sizeScore: 10, riskSignals: [] }).size).toBe('XL');
    });

    it('detects Risk 2 signals', () => {
      expect(assessTask({ sizeScore: 2, riskSignals: ['auth'] }).risk).toBe(2);
      expect(assessTask({ sizeScore: 2, riskSignals: ['updating payment info'] }).risk).toBe(2);
      expect(assessTask({ sizeScore: 2, riskSignals: ['prod deployment'] }).risk).toBe(2);
    });

    it('detects Risk 1 signals', () => {
      expect(assessTask({ sizeScore: 2, riskSignals: ['some complex logic'] }).risk).toBe(1);
    });

    it('detects Risk 0 signals', () => {
      expect(assessTask({ sizeScore: 2, riskSignals: [] }).risk).toBe(0);
    });
  });

  describe('enforceTier', () => {
    it('sub-pro allows S/M Risk-0/1 task', () => {
      expect(enforceTier('sub-pro', { size: 'M', risk: 1 }).allowed).toBe(true);
      expect(enforceTier('sub-pro', { size: 'S', risk: 0 }).allowed).toBe(true);
    });

    it('sub-pro refuses XL task and escalates to sub-max', () => {
      const res = enforceTier('sub-pro', { size: 'XL', risk: 0 });
      expect(res.allowed).toBe(false);
      expect(res.escalateTo).toBe('sub-max');
    });

    it('sub-pro refuses Risk-2 task and escalates to sub-max', () => {
      const res = enforceTier('sub-pro', { size: 'M', risk: 2 });
      expect(res.allowed).toBe(false);
      expect(res.escalateTo).toBe('sub-max');
    });

    it('sub-max allows what sub-pro refused (XL size)', () => {
      const res = enforceTier('sub-max', { size: 'XL', risk: 1 });
      expect(res.allowed).toBe(true);
    });

    it('sub-max allows Risk-2', () => {
      const res = enforceTier('sub-max', { size: 'M', risk: 2 });
      expect(res.allowed).toBe(true);
    });
  });

  describe('deriveLoopParams', () => {
    it('returns single-pass maxRevisions for sub-pro', () => {
      const params = deriveLoopParams('sub-pro');
      expect(params.maxRevisions).toBe(1);
    });
  });
});
