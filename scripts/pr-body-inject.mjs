#!/usr/bin/env node
/**
 * @file pr-body-inject.mjs
 * @description Injects visual verifier output into a PR body template robustly and idempotently.
 */

import fs from 'fs';
import path from 'path';

const originalLog = console.log;
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

function main() {
  const templatePath = process.argv[2];
  const manifestPath = process.argv[3];
  const verifyPayloadPath = process.argv[4];

  if (!templatePath || !fs.existsSync(templatePath)) {
    console.error(`Template path missing or invalid: ${templatePath}`);
    process.exit(1);
  }

  let body = fs.readFileSync(templatePath, 'utf8');

  let manifest = null;
  if (manifestPath && fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  let verifyPayload = null;
  if (verifyPayloadPath && fs.existsSync(verifyPayloadPath)) {
    verifyPayload = JSON.parse(fs.readFileSync(verifyPayloadPath, 'utf8'));
  }

  // Handle Screenshots Injection
  const screenshotSectionRegex = /^##\s*Screenshots\b.*$/im;
  const startAnchor = '<!-- pr-automator:screenshots:start -->';
  const endAnchor = '<!-- pr-automator:screenshots:end -->';

  let screenshotContent = '';

  if (manifest && manifest.status === 'blocked') {
    screenshotContent = `> ⚠️ Screenshots pending — evidence capture blocked (${manifest.reason}). Add before marking Ready for review.`;
  } else if (verifyPayload && verifyPayload.path === 'A') {
    const urls = verifyPayload.urls;
    const dt = urls.find((u) => u.viewport === 'desktop')?.url;
    const tb = urls.find((u) => u.viewport === 'tablet')?.url;
    const mb = urls.find((u) => u.viewport === 'mobile')?.url;

    screenshotContent = `| Desktop | Tablet | Mobile |
| :------ | :----- | :----- |
| ${dt ? `![Desktop](${dt})` : 'N/A'} | ${tb ? `![Tablet](${tb})` : 'N/A'} | ${mb ? `![Mobile](${mb})` : 'N/A'} |`;

    if (verifyPayload.failedUrls && verifyPayload.failedUrls.length > 0) {
      screenshotContent += `\n\n> 📎 **Screenshots pending / fallback:**\n> Viewports failed to upload or verify: ${verifyPayload.failedUrls.map((u) => u.viewport).join(', ')}`;
    }
  } else if (verifyPayload && verifyPayload.path === 'B') {
    const localFolder =
      verifyPayload.localFolder ||
      (manifest && manifest.outputDir) ||
      '.ai/evidence/unknown';
    screenshotContent = `> 📎 **Screenshots captured locally — drag and drop them here.**
> Inline embedding was skipped because private repository / evidence push is unavailable, and evidence must not be stored outside this repo.
>
> Files are in \`${localFolder}\` (gitignored, not committed):
>
> - [ ] \`desktop.png\` — 1920×1080
> - [ ] \`tablet.png\` — 768×1024
> - [ ] \`mobile.png\` — 375×667
>
> Drop them into this description, then tick the boxes and click "Ready for review".`;
  }

  // Idempotent replace logic
  const existingAnchorRegex = new RegExp(
    `${startAnchor}[\\s\\S]*?${endAnchor}`,
    'm'
  );
  const injectionBlock = `${startAnchor}\n${screenshotContent}\n${endAnchor}`;

  if (existingAnchorRegex.test(body)) {
    body = body.replace(existingAnchorRegex, injectionBlock);
  } else if (screenshotSectionRegex.test(body)) {
    // Replace the tip block beneath it
    body = body.replace(
      /(^##\s*Screenshots\b.*$)([\s\S]*?)(^## |\Z)/im,
      (match, header, content, nextHeader) => {
        return `${header}\n\n${injectionBlock}\n\n${nextHeader}`;
      }
    );
  }

  // Code Review Checklist injection
  const codeReviewAnchorRegex =
    /-\s*\[\s*\]\s*\{\{code-review-checklist-evidence\}\}/gi;
  if (codeReviewAnchorRegex.test(body)) {
    // Replace the checkbox with checked state and a note.
    body = body.replace(
      codeReviewAnchorRegex,
      '- [x] AI code review completed — see audit below'
    );
    // For this context we'll append a placeholder report at the very end to avoid list breakage.
    const preCommitReviewPath = '.ai/evidence/pre-commit-review.md';
    let auditReport = 'No audit report found.';
    if (fs.existsSync(preCommitReviewPath)) {
      auditReport = fs.readFileSync(preCommitReviewPath, 'utf8');
      // strip "## 🛠 Outcome Actions"
      auditReport = auditReport
        .replace(/## 🛠 Outcome Actions[\s\S]*?$/, '')
        .trim();
    }

    // Add idempotent anchors for the code review report
    const auditStart = '<!-- pr-automator:audit:start -->';
    const auditEnd = '<!-- pr-automator:audit:end -->';

    const existingAuditRegex = new RegExp(
      `${auditStart}[\\s\\S]*?${auditEnd}`,
      'm'
    );
    const fullAuditBlock = `${auditStart}\n\n## AI Code Review Audit\n\n${auditReport}\n${auditEnd}`;

    if (existingAuditRegex.test(body)) {
      body = body.replace(existingAuditRegex, fullAuditBlock);
    } else {
      body += `\n\n${fullAuditBlock}\n`;
    }
  }

  const outPath = '.ai/tmp/pr-body.md';
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body, 'utf8');

  console.log(`✅ Injected PR body written to ${outPath}`);

  process.stdout.write(
    JSON.stringify(
      {
        status: 'success',
        outPath,
      },
      null,
      2
    ) + '\n'
  );
}

main();
