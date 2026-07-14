/**
 * scripts/reflexion-issue-runner.js
 *
 * Entry point for the GitHub action runner.
 * Communicates ONLY through issue comments and workflow artifacts. Never pushes to the repo.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');
const {
  extractRunIdMarker,
  extractProcessedCommentIdMarker,
  extractYamlBlock,
  formatRunnerComment,
  validateAnswers,
} = require('./reflexion-issue-runner-utils.js');

const RUN_ID = process.env.GITHUB_RUN_ID;
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const TOKEN = process.env.GITHUB_TOKEN;
const WORKSPACE = process.env.GITHUB_WORKSPACE || process.cwd();

const OUT_DIR = path.join(WORKSPACE, '.reflexion-out');

async function main() {
  if (!EVENT_PATH || !fs.existsSync(EVENT_PATH)) {
    console.error('GITHUB_EVENT_PATH is not set or file does not exist.');
    process.exit(1);
  }

  const eventPayload = JSON.parse(fs.readFileSync(EVENT_PATH, 'utf-8'));

  try {
    if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
      await handleDispatchPath(eventPayload);
    } else if (process.env.GITHUB_EVENT_NAME === 'issue_comment') {
      await handleResumePath(eventPayload);
    } else if (process.env.GITHUB_EVENT_NAME === 'issues') {
      await handleStartPath(eventPayload);
    } else {
      console.log('Unhandled event type:', process.env.GITHUB_EVENT_NAME);
    }
  } catch (err) {
    console.error('Runner error:', err);
    await postDiagnosticComment(eventPayload, err.message);
    process.exit(1);
  }
}

async function handleDispatchPath(payload) {
  const issueNumber = payload.inputs?.issue_number;
  if (!issueNumber) {
    console.error('No issue number provided in dispatch inputs.');
    process.exit(0);
  }

  // Fetch issue details using the REST API to act like a normal labeled event
  const repo = process.env.GITHUB_REPOSITORY;
  const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch issue data: ${res.statusText}`);
  }

  const issue = await res.json();
  await handleStartPath({ issue });
}

async function handleStartPath(payload) {
  const issue = payload.issue;
  if (!issue) {
    console.error('No issue found in payload.');
    process.exit(0);
  }

  console.log(`Starting loop for issue #${issue.number}`);

  const maxRevisions = process.env.REFLEXION_MAX_REVISIONS || '3';
  const maxCostUsd = process.env.REFLEXION_MAX_COST_USD || '3';

  const turnCount = await countTurns(issue.number);
  if (turnCount >= 10) {
    throw new Error('Hard stop: Maximum of 10 loop turns per issue reached.');
  }

  const brief = `${issue.title}\n\n${issue.body || ''}`;

  const briefFile = path.join(WORKSPACE, 'reflexion-brief.md');
  fs.writeFileSync(briefFile, brief, 'utf-8');

  console.log('Invoking reflexion-loop.ts for start...');
  const cmd = 'npx';
  const args = [
    'tsx',
    'scripts/reflexion-loop.ts',
    '--brief-file',
    briefFile,
    '--repo',
    WORKSPACE,
    '--max',
    maxRevisions,
    '--out',
    OUT_DIR,
  ];

  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, REFLEXION_MAX_COST_USD: maxCostUsd },
  });

  if (result.status !== 0 && result.status !== 2) {
    throw new Error(`Reflexion script failed with status ${result.status}`);
  }

  await postResultComment(issue.number, null);
}

async function countTurns(issueNumber) {
  const repo = process.env.GITHUB_REPOSITORY;
  const listCommentsUrl = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments?per_page=100`;

  const res = await fetch(listCommentsUrl, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) return 0;

  const comments = await res.json();
  let count = 0;
  for (const c of comments) {
    if (
      c.user.login === 'github-actions[bot]' &&
      c.body.includes('<!-- reflexion-run:')
    ) {
      count++;
    }
  }
  return count;
}

async function downloadArtifact(runId, artifactName, token) {
  console.log(`Downloading artifact ${artifactName} from run ${runId}`);

  const repo = process.env.GITHUB_REPOSITORY;
  const listUrl = `https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts`;

  const res = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list artifacts: ${res.statusText}`);
  }

  const data = await res.json();
  const artifact = data.artifacts.find((a) => a.name === artifactName);

  if (!artifact) {
    throw new Error(`Artifact ${artifactName} not found for run ${runId}`);
  }

  const downloadUrl = artifact.archive_download_url;
  const downloadRes = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!downloadRes.ok) {
    throw new Error(`Failed to download artifact: ${downloadRes.statusText}`);
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  const zipFile = path.join(WORKSPACE, 'artifact.zip');
  fs.writeFileSync(zipFile, Buffer.from(arrayBuffer));

  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipFile);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  zip.extractAllTo(OUT_DIR, true);

  console.log(`Artifact extracted to ${OUT_DIR}`);
}

async function handleResumePath(payload) {
  const comment = payload.comment;
  const issue = payload.issue;

  if (!comment || !issue) return;

  if (comment.user.login === 'github-actions[bot]') {
    console.log('Ignoring comment from github-actions[bot]');
    return;
  }

  if (!comment.body.startsWith('/reflexion')) {
    console.log('Not a reflexion command comment.');
    return;
  }

  console.log(`Resuming loop for issue #${issue.number}`);

  const repo = process.env.GITHUB_REPOSITORY;
  const listCommentsUrl = `https://api.github.com/repos/${repo}/issues/${issue.number}/comments?per_page=100`;

  const res = await fetch(listCommentsUrl, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list comments: ${res.statusText}`);
  }

  const comments = await res.json();

  // Idempotency check: has the bot already replied to THIS comment ID?
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (c.user.login === 'github-actions[bot]') {
      const processedId = extractProcessedCommentIdMarker(c.body);
      if (processedId === String(comment.id)) {
        console.log(
          `Comment ID ${comment.id} has already been processed by the bot. Idempotency safeguard applied.`
        );
        process.exit(0);
      }
    }
  }

  const turnCount = await countTurns(issue.number);
  if (turnCount >= 10) {
    throw new Error('Hard stop: Maximum of 10 loop turns per issue reached.');
  }

  const yamlBlock = extractYamlBlock(comment.body);
  if (!yamlBlock) {
    throw new Error('No YAML block found in the comment.');
  }

  let parsedYaml;
  try {
    parsedYaml = yaml.load(yamlBlock);
  } catch (e) {
    throw new Error('Failed to parse YAML block: ' + e.message);
  }

  const validation = validateAnswers(parsedYaml);
  if (!validation.success) {
    throw new Error(
      'YAML block schema validation failed:\n' + validation.error.message
    );
  }

  let prevRunId = null;
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (c.user.login === 'github-actions[bot]') {
      const runId = extractRunIdMarker(c.body);
      if (runId) {
        prevRunId = runId;
        break;
      }
    }
  }

  if (!prevRunId) {
    throw new Error(
      'Could not find a previous run ID marker from a bot comment to resume from.'
    );
  }

  await downloadArtifact(prevRunId, `reflexion-state-${issue.number}`, TOKEN);

  const answersFile = path.join(WORKSPACE, 'reflexion-answers.yaml');
  fs.writeFileSync(
    answersFile,
    `\`\`\`yaml answers:\n${yamlBlock}\n\`\`\``,
    'utf-8'
  );

  console.log('Invoking reflexion-loop.ts for resume...');
  const maxCostUsd = process.env.REFLEXION_MAX_COST_USD || '3';
  const cmd = 'npx';
  const args = [
    'tsx',
    'scripts/reflexion-loop.ts',
    '--resume',
    OUT_DIR,
    '--answers',
    answersFile,
  ];

  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, REFLEXION_MAX_COST_USD: maxCostUsd },
  });

  if (result.status !== 0 && result.status !== 2) {
    throw new Error(`Reflexion script failed with status ${result.status}`);
  }

  await postResultComment(issue.number, comment.id);
}

async function postResultComment(issueNumber, triggeringCommentId) {
  const stateFiles = fs
    .readdirSync(OUT_DIR)
    .filter(
      (f) =>
        f.endsWith('.json') &&
        !f.endsWith('-answers.json') &&
        !f.endsWith('-critique.json') &&
        f !== 'eval.json'
    );
  if (stateFiles.length === 0) {
    throw new Error('No state file generated.');
  }

  const statePath = path.join(OUT_DIR, stateFiles[0]);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

  let scoreTable = '| Rev | Score |\n|---|---|\n';
  if (state.critiques) {
    state.critiques.forEach((c, idx) => {
      scoreTable += `| ${idx + 1} | ${c.score}/10 |\n`;
    });
  }

  let verdict = 'stop';
  if (state.stopReason === 'passed') verdict = 'approve';
  else if (
    state.stopReason === 'max-revisions' ||
    state.stopReason === 'budget-exceeded'
  )
    verdict = state.stopReason;
  else if (state.interview) verdict = state.interview.recommendation;

  let interviewQuestions = null;
  let answersTemplate = null;

  if (state.interview && state.interview.questions) {
    interviewQuestions = state.interview.questions
      .map((q) => `**${q.id}**: ${q.question}\n*Why: ${q.why}*`)
      .join('\n\n');
    answersTemplate = `\`\`\`yaml answers:\nrunId: "${RUN_ID}"\n# directive: "approve"\ndecisions:\n`;
    state.interview.questions.forEach((q) => {
      answersTemplate += `  - id: "${q.id}"\n    answer: ""\n`;
    });
    answersTemplate += '```';
  }

  let usageCost = `Total tokens: ${state.usage?.totalTokens || 0} (Cost: $${state.usage?.costUsd || 0})`;

  let idePrompt = null;
  if (verdict === 'approve') {
    const promptPath = path.join(OUT_DIR, 'ide-prompt.md');
    if (fs.existsSync(promptPath)) {
      idePrompt = fs.readFileSync(promptPath, 'utf-8');
    }
  }

  let commentBody = formatRunnerComment({
    runId: RUN_ID,
    triggeringCommentId: triggeringCommentId,
    scoreTable,
    adjudicatorVerdict: verdict,
    interviewQuestions,
    answersTemplate,
    usageCost,
    idePrompt,
  });

  if (state.criticDegraded) {
    commentBody =
      'WARNING: Critique ran in fallback mode (Gemini 3.1 Pro) because the Claude API was unavailable — model separation was reduced; review this plan with extra scrutiny.\n\n' +
      commentBody;
  }

  await createIssueComment(issueNumber, commentBody);

  if (verdict === 'approve') {
    await applyApprovedLabel(issueNumber);
  }
}

async function postDiagnosticComment(payload, errorMsg) {
  const issueNumber = payload.issue?.number || payload.inputs?.issue_number;
  if (!issueNumber) return;

  const triggeringCommentId = payload.comment?.id;

  const commentBody = formatRunnerComment({
    runId: RUN_ID,
    triggeringCommentId,
    diagnostic: errorMsg,
  });

  await createIssueComment(issueNumber, commentBody);
}

async function createIssueComment(issueNumber, body) {
  const repo = process.env.GITHUB_REPOSITORY;
  const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    console.error(`Failed to post comment: ${res.statusText}`);
  }
}

async function applyApprovedLabel(issueNumber) {
  const repo = process.env.GITHUB_REPOSITORY;
  const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ labels: ['reflexion:approved'] }),
  });

  if (!res.ok) {
    console.error(`Failed to apply label: ${res.statusText}`);
  }
}

main().catch((err) => {
  console.error('Fatal error in runner:', err);
  process.exit(1);
});
