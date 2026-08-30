const fs = require('fs');
const path = '.ai/skills/pr-automator.md';
let content = fs.readFileSync(path, 'utf8');

const regexBody = /     - \*\*Screenshots section:\*\* locate \`## Screenshots\` \(or similar\) and inject\n     the captured URLs, or the "pending" note if capture was blocked:\n\n     \`\`\`markdown\n     \| Desktop          \| Tablet          \| Mobile          \|\n     \| :--------------- \| :-------------- \| :-------------- \|\n     \| !\[Desktop\]\(URL1\) \| !\[Tablet\]\(URL2\) \| !\[Mobile\]\(URL3\) \|\n     \`\`\`/g;
const replacementBody = `     - **Screenshots section:** Handled by \`rtk run pr-body-inject <template> <manifest> <verifyPayload>\`. It will idempotently replace the screenshots block with a table of anonymously verified URLs (Path A) or a local drag-and-drop block (Path B) or a pending block.`;

content = content.replace(regexBody, replacementBody);

const regexDrafting = /     - \*\*Write RAW markdown to the body file\*\* — no surrounding \` \`\`\`markdown \`\n     fences\. Fences end up rendered literally in the PR\. The file at\n     \`\.github\/\.pr_body_temp\.md\` must contain exactly what should appear in the\n     PR description\./g;
const replacementDrafting = `     - **Write RAW markdown to the body file** — no surrounding \` \`\`\`markdown \`
     fences. Fences end up rendered literally in the PR. The file at
     \`.ai/tmp/pr-body.md\` must contain exactly what should appear in the
     PR description.`;

content = content.replace(regexDrafting, replacementDrafting);

fs.writeFileSync(path, content, 'utf8');
