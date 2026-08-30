const fs = require('fs');
const path = '.ai/skills/pr-automator.md';
let content = fs.readFileSync(path, 'utf8');

const oldLine = "| `unknown flag: --body-file`                  | Use the fallback: `--body \"$(cat .ai/tmp/pr-body.md)\"`.                                                       |";
const newLine = "| `unknown flag: --body-file`                  | Use the fallback: `--body \"$(cat .ai/tmp/pr-body.md)\"`.                                                           |";

content = content.replace(oldLine, newLine);
fs.writeFileSync(path, content, 'utf8');
