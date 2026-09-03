import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);
const matter = require('../packages/core/node_modules/gray-matter');

const dirs = ['.ai/skills', '.ai/pm-skills', '.ai/hr-skills'];
const coverage = [];
const mixedBlocks = [];

const validTitles = {
  'methodology alignment': 'four-pillars',
  'four pillars': 'four-pillars',
  'user sovereignty': 'user-sovereignty',
  'user sovereignty & persistence': 'user-sovereignty',
  'diagnosis before advice': 'diagnosis-first',
  'g-stack ethos': 'four-pillars', // just in case
};

const policyMarkers = [
  'four pillars',
  'user sovereignty',
  'diagnosis before advice',
  'g-stack ethos',
  'minimumcd',
  'modern web guidance',
  'agent skills',
];
const skillKeywords = [
  ' pr ',
  'pull request',
  'file ceiling',
  'ledger',
  'protocol',
  'maximum',
  'batch',
  'sub-pro',
  'sub-max',
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const filePath = path.join(dir, file);
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(rawContent);

    const policies = parsed.data.policies || [];

    let newContent = rawContent;
    let pureBlocksRemoved = 0;
    let mixedBlocksFlagged = 0;

    // Find all callout blocks in the body
    // A block is a run of lines starting with `>`
    const blockRegex = /(?:^>.*\r?\n?)+/gm;
    const bodyStartIdx = rawContent.indexOf(parsed.content);
    if (bodyStartIdx === -1) continue;

    let bodyContent = parsed.content;
    let match;

    // We will process blocks one by one
    // Because replacing while matching is tricky, we collect them first
    const blocks = [...bodyContent.matchAll(blockRegex)];

    // Reverse so replacements don't mess up indices
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i][0];
      const blockStartIdx = blocks[i].index;
      const blockEndIdx = blockStartIdx + block.length;

      // Extract title
      const firstLine = block.split('\n')[0];
      const titleMatch = firstLine.match(/\*\*([^*]+)\*\*/);

      let isPure = false;
      let isMixed = false;
      let mappedPolicy = null;
      let blockTitle = '';

      if (titleMatch) {
        blockTitle = titleMatch[1].trim().toLowerCase();
        mappedPolicy = validTitles[blockTitle];
      }

      const lowerBlock = block.toLowerCase();
      const hasMarker = policyMarkers.some((m) => lowerBlock.includes(m));
      const hasSkillSpecific =
        skillKeywords.some((m) => lowerBlock.includes(m)) ||
        hasSkillSpecificSubheader(block);

      if (mappedPolicy && !hasSkillSpecific) {
        isPure = true;
      } else if (
        (mappedPolicy && hasSkillSpecific) ||
        (!mappedPolicy && hasMarker)
      ) {
        isMixed = true;
      }

      if (isPure) {
        if (policies.includes(mappedPolicy)) {
          // Remove block, also remove adjacent <!-- --> and collapse blanks
          let before = bodyContent.substring(0, blockStartIdx);
          let after = bodyContent.substring(blockEndIdx);

          // Remove adjacent repo separator <!-- -->
          before = before.replace(/\n*<!--\s*-->\n*$/, '\n\n');
          after = after.replace(/^\n*<!--\s*-->\n*/, '\n\n');

          // Collapse blank lines
          bodyContent = before + after;
          bodyContent = bodyContent.replace(/\n{3,}/g, '\n\n');

          pureBlocksRemoved++;
        } else {
          isMixed = true;
          isPure = false;
        }
      }

      if (isMixed) {
        mixedBlocksFlagged++;
        // Get line number roughly
        const linesBefore = bodyContent
          .substring(0, blockStartIdx)
          .split('\n').length;
        const blockLines = block.split('\n').length;
        // Add frontmatter lines
        const frontmatterLines = (
          rawContent.substring(0, bodyStartIdx).match(/\n/g) || []
        ).length;
        const startLine = frontmatterLines + linesBefore;
        const endLine = startLine + blockLines - 1;

        mixedBlocks.push({
          file: filePath,
          range: `L${startLine}-L${endLine}`,
          text: block,
        });
      }
    }

    if (pureBlocksRemoved > 0) {
      newContent = rawContent.substring(0, bodyStartIdx) + bodyContent;
      fs.writeFileSync(filePath, newContent, 'utf8');
    }

    coverage.push({
      name: file.replace('.md', ''),
      pureBlocksRemoved,
      mixedBlocksFlagged,
    });
  }
}

function hasSkillSpecificSubheader(block) {
  const subheaders = [...block.matchAll(/>\s*(?:- \s*)?\*\*([^*]+)\*\*[:\-]/g)];
  const allowed = [
    'methodology alignment',
    'four pillars',
    'user sovereignty',
    'user sovereignty & persistence',
    'diagnosis before advice',
    'g-stack ethos',
    'minimumcd',
    'agent skills',
    'modern web guidance',
  ];
  for (const match of subheaders) {
    if (!allowed.includes(match[1].trim().toLowerCase())) {
      return true;
    }
  }
  return false;
}

console.log('| Name | Pure Blocks Removed | Mixed Blocks Flagged |');
console.log('|---|---|---|');
for (const c of coverage) {
  console.log(
    `| ${c.name} | ${c.pureBlocksRemoved} | ${c.mixedBlocksFlagged} |`
  );
}

console.log('\n--- MIXED / AMBIGUOUS BLOCKS FOR REVIEW ---');
for (const m of mixedBlocks) {
  console.log(`\nFile: ${m.file} (${m.range})`);
  console.log(m.text.trim());
}
