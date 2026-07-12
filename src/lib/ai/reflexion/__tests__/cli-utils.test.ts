import { parseYamlAnswers, formatInterviewMd } from '../../../../../scripts/reflexion-loop-utils';

describe('CLI logic', () => {
  it('parses answers block from plain YAML', () => {
    const yaml = `
runId: "run-123"
directive: "approve"
decisions:
  - id: "q1"
    answer: "yes, sounds good"
`;
    const ans = parseYamlAnswers(yaml);
    expect(ans.runId).toBe('run-123');
    expect(ans.directive).toBe('approve');
    expect(ans.decisions).toHaveLength(1);
    expect(ans.decisions[0].id).toBe('q1');
    expect(ans.decisions[0].answer).toBe('yes, sounds good');
  });

  it('parses answers block from fenced block in markdown', () => {
    const md = `
Some text
\`\`\`yaml answers:
runId: "run-456"
decisions:
  - id: "q2"
    answer: "nope"
\`\`\`
Other text
`;
    const ans = parseYamlAnswers(md);
    expect(ans.runId).toBe('run-456');
    expect(ans.decisions[0].id).toBe('q2');
    expect(ans.decisions[0].answer).toBe('nope');
  });

  it('formats interview.md correctly', () => {
    const questions = [
      { id: 'q1', target: 'plan' as const, ref: '## Setup', question: 'What version?', why: 'Need to know' }
    ];
    const md = formatInterviewMd('run-789', questions);
    expect(md).toContain('## Questions');
    expect(md).toContain("**q1** [plan `## Setup`]: What version?");
    expect(md).toContain('```yaml answers:');
    expect(md).toContain('runId: "run-789"');
    expect(md).toContain('id: "q1"');
    expect(md).toContain('answer: ""');
  });
});
