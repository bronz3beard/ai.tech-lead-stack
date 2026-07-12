import { buildRunner } from '../providers-env';
import * as aiModule from 'ai';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: {
    object: jest.fn()
  }
}));

describe('providers v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildRunner accumulates usage and provides interview()', async () => {
    (aiModule.generateText as jest.Mock)
      .mockResolvedValueOnce({ text: 'text', usage: { totalTokens: 10 } })
      .mockResolvedValueOnce({ output: { runId: '1' }, usage: { totalTokens: 20 } });

    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const mockModel: any = {};
    const runner = buildRunner(mockModel, mockModel, mockModel, { creator: 'a', critic: 'b', adjudicator: 'c' });

    expect(runner.getUsage().tokens).toBe(0);

    await runner.generate('prompt', 'system');
    expect(runner.getUsage().tokens).toBe(10);

    const interviewRes = await runner.interview('prompt', 'system');
    expect(interviewRes.runId).toBe('1');
    expect(runner.getUsage().tokens).toBe(30);

    spy.mockRestore();
  });
});
