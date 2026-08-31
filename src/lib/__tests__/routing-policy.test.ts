import { nextModelUp, shouldEscalate } from '../ai/routing-policy';

describe('routing-policy', () => {
  describe('nextModelUp', () => {
    it('returns the next model in the anthropic ladder', () => {
      expect(nextModelUp('claude-haiku-4-5')).toBe('claude-sonnet-4-6');
      expect(nextModelUp('claude-sonnet-4-6')).toBe('claude-opus-4-6');
    });

    it('returns null if at the top of the ladder', () => {
      expect(nextModelUp('claude-opus-4-6')).toBeNull();
      expect(nextModelUp('gemini-3.1-pro')).toBeNull();
      expect(nextModelUp('gpt-5.4')).toBeNull();
    });

    it('returns the next model in the gemini ladder', () => {
      expect(nextModelUp('gemini-3.6-flash')).toBe('gemini-3.1-pro-preview');
      expect(nextModelUp('gemini-3.1-pro-preview')).toBe('gemini-3.1-pro');
    });

    it('returns null for unknown models', () => {
      expect(nextModelUp('unknown-model')).toBeNull();
    });
  });

  describe('shouldEscalate', () => {
    it('returns false if less than 2 scores', () => {
      expect(shouldEscalate([7], 8)).toBe(false);
      expect(shouldEscalate([], 8)).toBe(false);
    });

    it('returns true if the last two scores are < threshold and not improving', () => {
      expect(shouldEscalate([8, 6, 6], 8)).toBe(true);
      expect(shouldEscalate([5, 4], 8)).toBe(true); // Regressed
    });

    it('returns false if improving', () => {
      expect(shouldEscalate([5, 6], 8)).toBe(false);
    });

    it('returns false if last score >= threshold', () => {
      expect(shouldEscalate([5, 8], 8)).toBe(false);
    });

    it('returns false if previous score >= threshold but last is < threshold', () => {
      expect(shouldEscalate([8, 7], 8)).toBe(false);
    });
  });
});
