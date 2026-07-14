const { z } = require('zod');

// We use the AnswersSchema definition structure from src/lib/ai/reflexion/schema.ts
const AnswersSchema = z.object({
  runId: z.string(),
  decisions: z
    .array(z.object({ id: z.string(), answer: z.string() }))
    .default([]),
  directive: z.enum(['approve', 'stop']).optional(),
});

function extractRunIdMarker(body) {
  if (!body) return null;
  const match = body.match(/<!--\s*reflexion-run:(\d+)\s*-->/);
  return match ? match[1] : null;
}

function extractProcessedCommentIdMarker(body) {
  if (!body) return null;
  const match = body.match(/<!--\s*processed-comment-id:(\d+)\s*-->/);
  return match ? match[1] : null;
}

function formatRunnerComment(opts) {
  const parts = [];

  parts.push(`<!-- reflexion-run:${opts.runId} -->`);
  if (opts.triggeringCommentId) {
    parts.push(`<!-- processed-comment-id:${opts.triggeringCommentId} -->`);
  }

  if (opts.diagnostic) {
    parts.push('### 🚨 Reflexion Loop Error');
    parts.push(opts.diagnostic);
    return parts.join('\n\n');
  }

  if (opts.idePrompt) {
    parts.push('### ✅ Reflexion Loop Approved');
    parts.push('The plan has been approved. The finalized prompt is below:');
    parts.push('<details><summary><b>ide-prompt.md</b></summary>');
    parts.push('');
    parts.push('```markdown');
    parts.push(opts.idePrompt);
    parts.push('```');
    parts.push('');
    parts.push('</details>');

    if (opts.usageCost) {
      parts.push(`\n*${opts.usageCost}*`);
    }
    return parts.join('\n\n');
  }

  parts.push('### 🤖 Reflexion Loop Status');

  if (opts.scoreTable) {
    parts.push(opts.scoreTable);
  }

  if (opts.adjudicatorVerdict) {
    parts.push(`**Verdict:** ${opts.adjudicatorVerdict}`);
  }

  if (opts.usageCost) {
    parts.push(`*${opts.usageCost}*`);
  }

  if (opts.interviewQuestions) {
    parts.push('#### Questions');
    parts.push(opts.interviewQuestions);
  }

  if (opts.answersTemplate) {
    parts.push('#### Your Turn: Reply to this issue');
    parts.push(
      'Copy and edit the YAML block below, and reply with it starting your comment with `/reflexion answers`:'
    );
    parts.push('');
    parts.push(opts.answersTemplate);
  }

  return parts.join('\n\n');
}

function extractYamlBlock(text) {
  if (!text) return null;
  const regex = /```([^\n]*)\n([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const infoString = match[1];
    const content = match[2];
    const cleanInfo = infoString.trim().toLowerCase().replace(/\s+/g, ' ');

    if (
      cleanInfo === 'yaml' ||
      cleanInfo === 'yml' ||
      cleanInfo === 'yaml answers:' ||
      cleanInfo === 'yml answers:' ||
      cleanInfo === 'answers:'
    ) {
      return content;
    }

    if (cleanInfo === '') {
      const lines = content.split('\n');
      const firstNonEmptyLine = lines
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      if (
        firstNonEmptyLine &&
        (firstNonEmptyLine.startsWith('runId:') ||
          firstNonEmptyLine.startsWith('answers:'))
      ) {
        return content;
      }
    }
  }
  return null;
}

function validateAnswers(yamlObj) {
  // We expect an object parseable by AnswersSchema
  return AnswersSchema.safeParse(yamlObj);
}

module.exports = {
  extractRunIdMarker,
  extractProcessedCommentIdMarker,
  formatRunnerComment,
  extractYamlBlock,
  validateAnswers,
};
