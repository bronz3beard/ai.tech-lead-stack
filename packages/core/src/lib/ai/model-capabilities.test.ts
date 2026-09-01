import { assertCanCritique, getModelCapabilities } from '../ai/model-capabilities';
import { MODELS } from '@/app/api/chat/constants';

describe('model-capabilities', () => {
  it('correctly identifies capable models', () => {
    expect(getModelCapabilities(MODELS.CLAUDE).supportsStructuredOutput).toBe(true);
    expect(getModelCapabilities(MODELS.GEMINI).supportsStructuredOutput).toBe(true);
    expect(getModelCapabilities(MODELS.OPENAI).supportsStructuredOutput).toBe(true);
  });

  it('correctly identifies incapable models', () => {
    expect(getModelCapabilities('o1-preview').supportsStructuredOutput).toBe(false);
    expect(getModelCapabilities('o1-mini').supportsStructuredOutput).toBe(false);
  });

  it('assertCanCritique passes for capable models', () => {
    expect(() => assertCanCritique(MODELS.CLAUDE)).not.toThrow();
  });

  it('assertCanCritique throws for incapable models', () => {
    expect(() => assertCanCritique('o1-preview')).toThrow(/lacks reliable structured output support/);
  });
});
