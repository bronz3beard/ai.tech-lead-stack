const fs = require('fs');
const path = '.ai/skills/pr-automator.md';
let content = fs.readFileSync(path, 'utf8');

// Use string replace instead of regex for these exact matches to avoid spacing issues
const bodyOld = `- **Screenshots section:** locate \`## Screenshots\` (or similar) and inject
     the captured URLs, or the "pending" note if capture was blocked:

     \`\`\`markdown
     | Desktop          | Tablet          | Mobile          |
     | :--------------- | :-------------- | :-------------- |
     | ![Desktop](URL1) | ![Tablet](URL2) | ![Mobile](URL3) |
     \`\`\``;
const bodyNew = `- **Screenshots section:** Handled by \`rtk run pr-body-inject <template> <manifest> <verifyPayload>\`. It will idempotently replace the screenshots block with a table of anonymously verified URLs (Path A) or a local drag-and-drop block (Path B) or a pending block.`;

content = content.replace(bodyOld, bodyNew);

const draftingOld = `- **Write RAW markdown to the body file** — no surrounding \` \`\`\`markdown \`
     fences. Fences end up rendered literally in the PR. The file at
     \`.github/.pr_body_temp.md\` must contain exactly what should appear in the
     PR description.`;
const draftingNew = `- **Write RAW markdown to the body file** — no surrounding \` \`\`\`markdown \`
     fences. Fences end up rendered literally in the PR. The file at
     \`.ai/tmp/pr-body.md\` must contain exactly what should appear in the
     PR description.`;

content = content.replace(draftingOld, draftingNew);

const cleanupOld = `   - **After successful creation**, clean up local temp files:

     \`\`\`bash
     rm -f .github/.pr_body_temp.md
     rm -f .ai/evidence/pre-commit-review.md   # only if runCodeReview was true
     rm -rf .github/evidence/                  # local screenshot temp, if any
     \`\`\``;
const cleanupNew = `   - **After successful creation**, clean up local temp files:

     \`\`\`bash
     rm -f .ai/tmp/pr-body.md
     rm -f .ai/evidence/pre-commit-review.md   # only if runCodeReview was true
     # Never delete .ai/evidence/<feature-branch>/ entirely since Path B users need to drag and drop from it
     \`\`\``;

content = content.replace(cleanupOld, cleanupNew);

const cmdOld = `gh pr create \\
       --draft \\
       --base "<BASE_BRANCH>" \\
       --head "<HEAD_BRANCH>" \\
       --title "<TITLE>" \\
       --body-file .github/.pr_body_temp.md \\
       --assignee "<GH_LOGIN>" \\
       --label "<LABEL1>" --label "<LABEL2>"`;
const cmdNew = `gh pr create \\
       --draft \\
       --base "<BASE_BRANCH>" \\
       --head "<HEAD_BRANCH>" \\
       --title "<TITLE>" \\
       --body-file .ai/tmp/pr-body.md \\
       --assignee "<GH_LOGIN>"`;

content = content.replace(cmdOld, cmdNew);

const fallbackOld = `--body "$(cat .github/.pr_body_temp.md)"`;
const fallbackNew = `--body "$(cat .ai/tmp/pr-body.md)"`;

content = content.replace(fallbackOld, fallbackNew);

fs.writeFileSync(path, content, 'utf8');
