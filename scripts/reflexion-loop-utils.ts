import { Answers } from '../src/lib/ai/reflexion/schema';

export function parseYamlAnswers(text: string): Answers {
  // If it's a markdown file with a fenced block, extract the block
  const match = text.match(/```yaml answers:\s*([\s\S]*?)```/);
  const yamlContent = match ? match[1] : text;

  const lines = yamlContent.split('\n');
  const result: any = { decisions: [] };
  let inDecisions = false;
  let currentDecision: any = null;

  for (let line of lines) {
    line = line.replace(/#.*$/, ''); // strip comments
    if (!line.trim()) continue;

    const runIdMatch = line.match(/^runId:\s*"?([^"]+)"?$/);
    if (runIdMatch) {
      result.runId = runIdMatch[1].trim();
      continue;
    }

    const directiveMatch = line.match(/^directive:\s*"?([^"]+)"?$/);
    if (directiveMatch) {
      result.directive = directiveMatch[1].trim();
      continue;
    }

    if (line.match(/^decisions:/)) {
      inDecisions = true;
      continue;
    }

    if (inDecisions) {
      const idMatch = line.match(/^\s*-\s*id:\s*"?([^"]+)"?$/);
      if (idMatch) {
        if (currentDecision) result.decisions.push(currentDecision);
        currentDecision = { id: idMatch[1].trim() };
        continue;
      }
      const answerMatch = line.match(/^\s*answer:\s*"?([^"]*)"?$/);
      if (answerMatch && currentDecision) {
        currentDecision.answer = answerMatch[1].trim();
      }
    }
  }
  if (currentDecision) result.decisions.push(currentDecision);

  return result as Answers;
}

export function formatInterviewMd(runId: string, questions: any[]): string {
  const md = [
    '# Reflexion Loop Interview',
    '',
    'The Adjudicator requires human input to proceed.',
    '',
    '## Questions',
  ];

  for (const q of questions) {
    md.push(`**${q.id}** [${q.target} \`${q.ref}\`]: ${q.question}`);
    md.push(`*Why: ${q.why}*`);
    md.push('');
  }

  md.push('## Answers');
  md.push('Fill in the `answer` fields below, or set `directive` to `approve` or `stop`.');
  md.push('```yaml answers:');
  md.push(`runId: "${runId}"`);
  md.push('# directive: "approve"');
  md.push('decisions:');

  for (const q of questions) {
    md.push(`  - id: "${q.id}"`);
    md.push(`    answer: ""`);
  }

  md.push('```');

  return md.join('\n');
}
