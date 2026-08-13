const fs = require('fs');
const path = '.ai/skills/pr-automator.md';
let content = fs.readFileSync(path, 'utf8');

const tableHeaderRegex = /\| Error                                        \| Fix                                                                                                                 \|/;
const newTable = `| Error                                        | Fix                                                                                                                 |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| \`could not add label: 'X' not found\`         | Only pass labels confirmed by \`gh label list\`. Drop the unknown label (or omit \`--label\` entirely) and retry.       |
| assignee could not be added                  | Drop \`--assignee\` and retry. The PR opening matters more than self-assignment.                                      |
| \`unknown flag: --body-file\`                  | Use the fallback: \`--body "$(cat .ai/tmp/pr-body.md)"\`.                                                             |
| body file not found / bad path               | \`mkdir -p .ai/tmp\`, rewrite the body to \`.ai/tmp/pr-body.md\`, retry.                                                |
| gh drops into an interactive prompt / editor | You omitted a flag. Provide **all** of \`--base\`, \`--head\`, \`--title\`, and a body flag so it runs non-interactively. |`;

content = content.replace(/\| Error                                        \| Fix                                                                                                                 \|[\s\S]*?\| gh drops into an interactive prompt \/ editor \| You omitted a flag\. Provide \*\*all\*\* of \`--base\`, \`--head\`, \`--title\`, and a body flag so it runs non-interactively\. \|/, newTable);

fs.writeFileSync(path, content, 'utf8');
