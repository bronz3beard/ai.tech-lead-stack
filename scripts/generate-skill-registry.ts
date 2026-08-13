import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { z } from 'zod';
import * as prettier from 'prettier';

const skillsDir = path.join(process.cwd(), '.ai/skills');
const workflowsDir = path.join(process.cwd(), '.agents/workflows');
const manifestFile = path.join(process.cwd(), '.ai/cursor-skills.manifest');
const readmeFile = path.join(process.cwd(), 'README.md');

const frontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  cost: z.string().regex(/^~[0-9]+\s+tokens$/),
  modes: z.array(z.enum(['read-only', 'write', 'mcp'])).min(1),
  surface: z.enum(['public', 'internal']),
  category: z.string().optional(),
  how: z.string().optional(),
  useCase: z.string().optional(),
});

type Skill = z.infer<typeof frontmatterSchema>;

function parseSkills(): Skill[] {
  const files = fs
    .readdirSync(skillsDir)
    .filter((f: string) => f.endsWith('.md'));
  const skills: Skill[] = [];

  for (const file of files) {
    const filePath = path.join(skillsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(content);

    try {
      skills.push(frontmatterSchema.parse(data));
    } catch (e) {
      console.error(`Invalid frontmatter in ${file}:`, e);
      process.exit(1);
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function generateManifest(skills: Skill[]): string {
  let manifest = `# Cursor global skills: skill_directory|path relative to tech-lead-stack repo root\n`;
  manifest += `# Lines starting with # are ignored. skill_directory becomes ~/.cursor/skills/<dir>/SKILL.md -> symlink target.\n\n`;
  manifest += `# Core skills (.ai/skills)\n`;

  const publicSkills = skills.filter((s) => s.surface === 'public');
  for (const skill of publicSkills) {
    manifest += `${skill.name}|.ai/skills/${skill.name}.md\n`;
  }

  manifest += `\n# Antigravity-style workflows (.agents/workflows) — distinct names to avoid clashing with skills\n`;
  const workflows = fs
    .readdirSync(workflowsDir)
    .filter((f: string) => f.endsWith('.md'))
    .sort();
  for (const file of workflows) {
    const name = `workflow-${file.replace('.md', '')}`;
    manifest += `${name}|.agents/workflows/${file}\n`;
  }

  return manifest;
}

// Extract the original table rows from README.md to preserve Description, How it works, Use Case text
// For simplicity and since we overwrote the file with a placeholder, I'll hardcode the known original rows
// to ensure we don't lose the "How it works" and "Use Case" columns which aren't in frontmatter.
const originalRows: Record<string, string[]> = {
  'accessibility-auditor': [
    'Specialized audit for Web Accessibility (A11y). Scans for contrast, semantics, and ARIA debt.',
    'Static analysis via `grep`, visual scrutiny of CSS, and read-only runtime DOM inspection.',
    'Ensuring WCAG 2.1 compliance and multi-viewport accessibility.',
  ],
  'mission-architect': [
    'Master Blueprint Engine. Orchestrates Strategy -> Research -> Plan -> Deliver for complex features.',
    'Strategic extraction from roadmaps, deep codebase audit, and multi-stage planning via `planning-expert`.',
    'Designing and executing a major architectural change or multi-file feature.',
  ],
  'planning-expert': [
    'The complete Planning Expert. Orchestrates deep pattern discovery, vertical slicing, and safe incremental delivery.',
    'Deep codebase audit followed by an atomic G-Stack blueprint and commit-ready task list.',
    'Breaking down complex Jira tickets or architectural refactors into test-driven steps.',
  ],
  'planning-expert-quick': [
    'Ultra-lean strategic planning. Optimized for speed, token efficiency, and rapid MVC delivery.',
    'Anchors tech stack followed by a condensed W/W/H blueprint and rapid execution cycle.',
    'Common, less complex, lite-weight tasks where velocity is the priority.',
  ],
  'regression-bug-fix': [
    'Unified remediation engine for resolving QA, Design Review (DR), and Regression feedback.',
    'Maps feedback to code impact, generates a localized remediation plan, and verifies the fix against regressions.',
    'Fixing "Login button misaligned" or "API returning 500" after a QA pass.',
  ],
  'code-review-checklist': [
    'High-density pre-commit quality auditor for verifying functionality and G-Stack standards.',
    'Analyzes local diffs against 4 gates (Spec, SOLID, A11y, Evidence), ensuring zero `any` types and compliance.',
    'Rapid local verification before running `rtk run create-pr`.',
  ],
  'clean-code': [
    'Architectural auditor enforcing SOLID principles and programmatic standards (KISS, DRY, YAGNI).',
    'Scans for "God Objects" and tight coupling. Recommends strategy patterns and colocation of code.',
    'Checking a new feature branch before merging to prevent technical debt.',
  ],
  'security-audit': [
    'Cross-platform security scanner detecting malware, prompt injection, and exfiltration.',
    'Scans skills, scripts, and inputs for malicious patterns (`curl \\| bash`, `eval()`).',
    'Running on agent-generated scripts to ensure no backdoors are introduced.',
  ],
  'pr-automator': [
    'Automates G-Stack Pull Requests with synthesized diffs and verification evidence.',
    'Fetches visual proof (screenshots) and maps code changes to the original Strategic Mission.',
    'Finalizing a feature branch into a professional, evidence-backed PR.',
  ],
  'visual-verifier': [
    'Captures before/after screen evidence for visual smoke testing.',
    'Runs local app via Playwright and captures Desktop/Mobile screenshots for the PR body.',
    'Proving that a CSS fix works as intended across different viewports.',
  ],
  'changelog-generator': [
    'Transforms Git history into user-facing release notes with strict noise filtering.',
    'Ingests `git log`, groups by semantic commit type, filters noise, and formats to Markdown.',
    'Generating clean release notes for stakeholders.',
  ],
  'daily-standup': [
    'Generates a daily status update by analyzing 48h of git activity and task progress.',
    'Categorizes commits, assess blockers, and generates a rolling report using a professional standup template.',
    'Automating your daily update or summarizing work for a sync meeting.',
  ],
  ask: [
    'Expert technical advisor providing architectural insights and precise code snippets for manual implementation.',
    'Diagnostic research via Phase 0 discovery, followed by high-density technical advice and snippets.',
    'Q&A about the codebase or "How would I change this?" queries.',
  ],
  'product-strategist': [
    'Strategic roadmap auditor validating market positioning and Impact vs. Effort.',
    'Scans metrics and positioning to ensure current implementation work maps to high-ROI customer goals.',
    'Auditing a proposed feature list against the core product vision.',
  ],
  'feature-design-assistant': [
    'Architectural discovery engine for pre-implementation prototyping.',
    'Discovers existing patterns and generates technical specs before the first line of code is written.',
    'High-level ideation for a new service or module.',
  ],
  'feature-orchestrator': [
    'Three-Phase Engine — Research -> Plan -> Implement for a single feature (chat-safe, IDE-executing).',
    'Chains specialist skills (design assistant, planning expert/decomposer, verification auditor) into a governed, runtime-aware loop.',
    'Use from the feature-discovery chat to drive a single-feature change end-to-end in the sandbox app.',
  ],
  'style-logic-exporter': [
    'Extraction engine for transforming CSS/Tailwind logic into portable design tokens for Figma.',
    'Scans style sheets and theme configurations to extract variables, colors, and typography metrics.',
    'Syncing code-based styling with design systems or external documentation.',
  ],
  'technical-debt-auditor': [
    'Scans codebase for anti-patterns, complexity hotspots, and architectural drift.',
    'Metrics-driven analysis combined with G-Stack methodology to prioritize refactoring tasks.',
    'Routine codebase maintenance and pre-refactoring audits.',
  ],
  'vertical-slice-decomposer': [
    'Decomposes user stories (optionally with design screenshots / Figma URLs) into thin, independently deployable vertical slices (<=2d) and emits ClickUp-ready tasks (title, technical details, dev technical prompt, design reference, beta-flag decision, mock-vs-real decision).',
    'Phase 0 stack + domain-boundary + design-input discovery, then a deployability-test + BDD + design-state slicing engine, a persistent Slice Ledger for multi-turn anti-drift, and a fixed Output Contract per task.',
    'Turning brownfield/greenfield stories and designs into 2-day, dark-releasable slices under Trunk-Based Development.',
  ],
  'qa-handover-generator': [
    'Produces a QA handover + universal smoke-test criteria document for a changed feature and delivers it to ClickUp.',
    'Performs Phase 0 G-Stack discovery of state architecture, maps components to server-driven vs client-side patterns, and renders ClickUp markup via the clickup-format module.',
    'Generating high-fidelity QA handovers and smoke test checklists for developers and automated testing agents.',
  ],
};

const CATEGORY_ORDER = [
  'Orchestrators',
  'Discover & Define',
  'Plan & Harden',
  'Build & Fix',
  'Review & Verify',
  'Design & UI',
  'Ship & Communicate',
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Orchestrators:
    'High-level directors that coordinate other skills and drive multi-step workflows.',
  'Discover & Define':
    'Exploratory agents for codebase onboarding, requirement gathering, and technical design.',
  'Plan & Harden':
    'Strategic planners that break down work into atomic steps and vertical slices.',
  'Build & Fix':
    'Implementation engines for fixing bugs and addressing feedback.',
  'Review & Verify':
    'Quality gatekeepers for code standards, accessibility, and security.',
  'Design & UI':
    'Visual agents focused on UI specs, styling logic, and layout verification.',
  'Ship & Communicate': 'Automation for PRs, changelogs, and team updates.',
  Uncategorised: 'Skills that have not yet been assigned a category.',
};

function generateReadmeTable(skills: Skill[]): string {
  let table = `<!-- SKILLS_TABLE:START -->\n\n`;

  const publicSkills = skills.filter((s) => s.surface === 'public');

  const categorized = new Map<string, Skill[]>();
  const uncategorized: Skill[] = [];

  for (const s of publicSkills) {
    if (s.category && CATEGORY_ORDER.includes(s.category)) {
      if (!categorized.has(s.category)) {
        categorized.set(s.category, []);
      }
      categorized.get(s.category)!.push(s);
    } else {
      uncategorized.push(s);
      if (s.category) {
        console.error(
          'ERROR: Skill ' +
            s.name +
            " has unrecognised category '" +
            s.category +
            "'"
        );
      } else {
        console.error('ERROR: Skill ' + s.name + ' has no category');
      }
    }
  }

  if (uncategorized.length > 0) {
    console.error(
      'ERROR: Uncategorised skills found. All public skills must be categorised.'
    );
    process.exit(1);
  }

  console.log('✅ Uncategorised group is EMPTY for all public skills.');

  const getRow = (s: Skill) => {
    let description = s.description.replace(/\n/g, ' ');
    let how = s.how || '-';
    let useCase = s.useCase || '-';
    if (originalRows[s.name]) {
      if (how === '-') how = originalRows[s.name][1];
      if (useCase === '-') useCase = originalRows[s.name][2];
    }
    const modesStr = s.modes.join(', ');
    return `| **\`${s.name}\`** | ${description} | ${how} | ${useCase} | ${modesStr} | ${s.cost} |\n`;
  };

  const renderCategory = (title: string, catSkills: Skill[]) => {
    if (catSkills.length === 0) return '';
    let res = `### ${title}\n\n`;
    if (CATEGORY_DESCRIPTIONS[title]) {
      res += `${CATEGORY_DESCRIPTIONS[title]}\n\n`;
    }
    res += `| Skill | Description | How it works | Use Case | Modes | Est. Context Footprint |\n`;
    res += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const s of catSkills) {
      res += getRow(s);
    }
    res += `\n`;
    return res;
  };

  for (const cat of CATEGORY_ORDER) {
    const catSkills = categorized.get(cat) || [];
    table += renderCategory(cat, catSkills);
  }

  // We no longer render the Uncategorised section because the build fails above if any exist.

  table += `### Internal Skills\n\n`;
  table += `| Skill | Description | Modes | Est. Context Footprint |\n`;
  table += `| :--- | :--- | :--- | :--- |\n`;

  const internalSkills = skills.filter((s) => s.surface === 'internal');
  for (const s of internalSkills) {
    const desc = s.description.replace(/\n/g, ' ');
    const modesStr = s.modes.join(', ');
    table += `| **\`${s.name}\`** | ${desc} | ${modesStr} | ${s.cost} |\n`;
  }

  table += `\n<!-- SKILLS_TABLE:END -->`;
  return table;
}

function injectTable(readmeContent: string, newTable: string): string {
  // If we placed [[TABLE_PLACEHOLDER]] with the helper script, simply replace it
  if (readmeContent.includes('[[TABLE_PLACEHOLDER]]')) {
    return readmeContent.replace('[[TABLE_PLACEHOLDER]]', newTable);
  }

  // Otherwise try replacing the markers
  const startMarker = '<!-- SKILLS_TABLE:START -->';
  const endMarker = '<!-- SKILLS_TABLE:END -->';

  if (
    readmeContent.includes(startMarker) &&
    readmeContent.includes(endMarker)
  ) {
    const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
    return readmeContent.replace(regex, newTable);
  }

  return readmeContent;
}

async function main() {
  const isCheck = process.argv.includes('--check');
  let outputDest = '';
  if (isCheck) {
    const checkIndex = process.argv.indexOf('--check');
    if (
      checkIndex + 1 < process.argv.length &&
      !process.argv[checkIndex + 1].startsWith('-')
    ) {
      outputDest = process.argv[checkIndex + 1];
    }
  }

  const skills = parseSkills();

  const newManifest = generateManifest(skills);
  const newTable = generateReadmeTable(skills);

  const currentReadme = fs.readFileSync(readmeFile, 'utf8');
  const rawReadme = injectTable(currentReadme, newTable);
  const prettierConfig = await prettier.resolveConfig(readmeFile);
  const newReadme = await prettier.format(rawReadme, {
    ...prettierConfig,
    filepath: readmeFile,
  });

  if (isCheck) {
    if (outputDest) {
      fs.writeFileSync(`${outputDest}/manifest.tmp`, newManifest);
      fs.writeFileSync(`${outputDest}/readme.tmp`, newReadme);
    } else {
      const currentManifest = fs.readFileSync(manifestFile, 'utf8');
      if (currentManifest !== newManifest) {
        console.error('Manifest is out of date.');
        process.exit(1);
      }
      if (currentReadme !== newReadme) {
        console.error('README skills table is out of date.');
        process.exit(1);
      }
      console.log('Registry check passed.');
    }
  } else {
    fs.writeFileSync(manifestFile, newManifest);
    fs.writeFileSync(readmeFile, newReadme);
    console.log('Generated skill registry successfully.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
