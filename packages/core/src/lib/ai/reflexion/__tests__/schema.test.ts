import { z } from 'zod';
import { InterviewSchema, LoopParamsPatchSchema } from '../schema';

describe('schema.ts additions', () => {
  it('LoopParamsPatch rejects unknown keys', () => {
    const validPatch = { passThreshold: 9 };
    expect(() => LoopParamsPatchSchema.parse(validPatch)).not.toThrow();

    const invalidPatch = { passThreshold: 9, unknownKey: true };
    expect(() => LoopParamsPatchSchema.parse(invalidPatch)).toThrow(z.ZodError);
  });

  it('InterviewSchema accepts valid interview', () => {
    const validInterview = {
      runId: '123',
      revision: 1,
      recommendation: 'approve',
      questions: [
        {
          id: 'q1',
          target: 'plan',
          ref: '## Phase 0',
          question: 'Are you sure?',
          why: 'Because I said so',
        },
      ],
    };
    expect(() => InterviewSchema.parse(validInterview)).not.toThrow();
  });

  it('InterviewSchema accepts >5 questions (no maxItems constraint)', () => {
    const questions = Array.from({ length: 6 }, (_, i) => ({
      id: `q${i}`,
      target: 'plan' as const,
      ref: '## Phase 0',
      question: 'Q',
      why: 'Why',
    }));

    const validInterview = {
      runId: '123',
      revision: 1,
      recommendation: 'refine-plan' as const,
      questions,
    };
    expect(() => InterviewSchema.parse(validInterview)).not.toThrow();
  });
});
