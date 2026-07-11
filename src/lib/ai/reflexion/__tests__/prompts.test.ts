import { sectionRefinePrompt } from '../prompts';

describe('prompts.ts additions', () => {
  it('sectionRefinePrompt includes necessary constraints', () => {
    const prompt = sectionRefinePrompt('## Phase 0', 'Fix it', 'RUBRIC_TEXT');
    expect(prompt).toContain('Return the complete plan. Do not alter any section except ## Phase 0');
    expect(prompt).toMatchSnapshot();
  });
});
