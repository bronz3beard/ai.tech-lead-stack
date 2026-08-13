const fs = require('fs');

const path = '.ai/skills/visual-verifier.md';
let content = fs.readFileSync(path, 'utf8');

const replacement = `     \`.ai/evidence/<feature-branch>/\`.
4. **Publish & Verify**:
   - Handled via \`publish-evidence\` and \`verify-evidence\`.
   - **Path A (Public Repo)**: Pushes screenshots to \`pr/evidence-<project-name>\` using Git Data API (no worktree checkouts), constructs permanent raw URLs pinned to a commit SHA, and verifies them anonymously.
   - **Path B (Private Repo / No Push)**: Skips publishing and leaves images in \`.ai/evidence/<feature-branch>/\` for local drag-and-drop.
5. **Validation**:
   - **Path A**: Confirm "Smoke Test Passed" once visual parity is confirmed across all viewports and raw URLs verify successfully anonymously.
   - **Path B**: Provide handoff block for local evidence attachment.
   - **Important**: Evidence images never leave the target repository. \`upload-evidence.mjs\` is strictly forbidden from this flow.`;

const regex = /     `\.github\/evidence\/<feature-branch>\/`\.\n4\. \*\*Upload — Git Evidence Branch\*\*[\s\S]*5\. \*\*Validation\*\*: Confirm "Smoke Test Passed" once visual parity is confirmed\n   across all viewports and raw URLs resolve successfully\./g;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content, 'utf8');
