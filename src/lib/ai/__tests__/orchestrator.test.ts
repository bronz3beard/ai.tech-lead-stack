import { validateDistinctModels } from '../orchestrator';

describe('validateDistinctModels', () => {
  describe('sub-pro tier (distinct-model isolation)', () => {
    it('throws if identical model is used', () => {
      expect(() => validateDistinctModels('claude-sonnet-4-6', 'claude-sonnet-4-6', 'sub-pro')).toThrow(
        /must be distinct to ensure objective code review/
      );
    });

    it('passes if different models from the same vendor are used', () => {
      expect(() => validateDistinctModels('claude-opus-4-6', 'claude-sonnet-4-6', 'sub-pro')).not.toThrow();
    });
  });

  describe('sub-max tier (distinct-vendor isolation)', () => {
    it('throws if models are from the same vendor', () => {
      expect(() => validateDistinctModels('claude-opus-4-6', 'claude-sonnet-4-6', 'sub-max')).toThrow(
        /must be from distinct AI vendors/
      );
    });

    it('passes if models are from different vendors', () => {
      expect(() => validateDistinctModels('claude-opus-4-6', 'gpt-5.4', 'sub-max')).not.toThrow();
    });
  });
});
