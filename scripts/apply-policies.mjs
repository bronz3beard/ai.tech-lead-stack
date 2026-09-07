import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);
const matter = require('../packages/core/node_modules/gray-matter');

const policyFiles = ['four-pillars', 'user-sovereignty', 'diagnosis-first'];
const missing = policyFiles.filter(
  (p) => !fs.existsSync(`.ai/policies/${p}.md`)
);
if (missing.length > 0) {
  console.error('Missing policy files:', missing);
  process.exit(1);
}

const dirs = ['.ai/skills', '.ai/pm-skills', '.ai/hr-skills'];
const coverage = [];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const filePath = path.join(dir, file);
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(rawContent);

    let domain = parsed.data.domain;
    if (!domain) {
      if (dir === '.ai/skills') domain = 'eng';
      else if (dir === '.ai/pm-skills') domain = 'product';
      else if (dir === '.ai/hr-skills') domain = 'hiring';
    }

    let kind = parsed.data.kind;
    const name = file.replace('.md', '');
    if (!kind) {
      if (
        name.includes('orchestrator') ||
        name.includes('mission-') ||
        name.includes('feature-')
      ) {
        kind = 'orchestrator';
      } else if (
        [
          'operational-boundaries',
          'agent-optimizer',
          'knowledge-manager',
        ].includes(name)
      ) {
        kind = 'policy';
      } else if (
        name === 'daily-standup' ||
        name === 'weekly-leadership-report' ||
        name.includes('-newsletter') ||
        name.includes('-release-note') ||
        name.includes('-progress-')
      ) {
        kind = 'report';
      } else {
        kind = 'skill';
      }
    }

    let policies = [];
    if (kind === 'orchestrator') {
      policies = ['user-sovereignty', 'diagnosis-first', 'four-pillars'];
    } else if (kind === 'report') {
      policies = ['user-sovereignty'];
    } else if (kind === 'policy') {
      policies = ['user-sovereignty'];
    } else if (domain === 'eng') {
      policies = ['user-sovereignty', 'diagnosis-first', 'four-pillars'];
    } else if (domain === 'product') {
      policies = ['user-sovereignty', 'diagnosis-first'];
    } else if (domain === 'hiring') {
      policies = ['user-sovereignty'];
    } else {
      policies = ['user-sovereignty', 'diagnosis-first'];
    }

    policies = Array.from(new Set(policies));

    const currentPolicies = parsed.data.policies || [];
    const isSame =
      currentPolicies.length === policies.length &&
      currentPolicies.every((v, i) => v === policies[i]);

    if (!isSame) {
      const policiesStr =
        'policies:\n' + policies.map((p) => `  - ${p}`).join('\n');
      let newContent = rawContent;

      const match = rawContent.match(/^---\n([\s\S]*?)\n---/);
      if (match) {
        let fm = match[1];
        if (/^policies:/m.test(fm)) {
          fm = fm.replace(
            /^policies:(?:[ \t]+.*)?(?:\n[ \t]+-.*)*/m,
            policiesStr
          );
        } else {
          fm = fm + '\n' + policiesStr;
        }
        newContent = `---\n${fm}\n---` + rawContent.substring(match[0].length);
      }

      fs.writeFileSync(filePath, newContent, 'utf8');
    }

    coverage.push({
      dir,
      name,
      domain,
      kind,
      policiesAssigned: policies.join(', '),
    });
  }
}

console.log('| Directory | Name | Domain | Kind | Policies Assigned |');
console.log('|---|---|---|---|---|');
const grouped = {};
for (const c of coverage) {
  if (!grouped[c.dir]) grouped[c.dir] = [];
  grouped[c.dir].push(c);
}

let total = 0;
for (const dir of dirs) {
  if (!grouped[dir]) continue;
  for (const c of grouped[dir]) {
    console.log(
      `| ${c.dir} | ${c.name} | ${c.domain} | ${c.kind} | ${c.policiesAssigned} |`
    );
    total++;
  }
  console.log(`| **${dir} Count** | **${grouped[dir].length}** | | | |`);
}
console.log(`| **Grand Total** | **${total}** | | | |`);
