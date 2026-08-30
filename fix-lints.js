const fs = require('fs');

// ProjectModelRouting.tsx
const p1 = 'src/components/settings/ProjectModelRouting.tsx';
let c1 = fs.readFileSync(p1, 'utf8');

c1 = c1.replace(
  `  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);`,
  `  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);`
);
fs.writeFileSync(p1, c1, 'utf8');

// providers-env.ts
const p2 = 'src/lib/ai/reflexion/providers-env.ts';
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace(`import type { Project } from '@prisma/client';\n`, '');
fs.writeFileSync(p2, c2, 'utf8');

// skills-readonly.test.ts
const p3 = 'src/mcp-server/__tests__/skills-readonly.test.ts';
let c3 = fs.readFileSync(p3, 'utf8');
c3 = c3.replace(`import fs from 'fs';\n`, '');
fs.writeFileSync(p3, c3, 'utf8');

// skill-posture.test.ts
const p5 = 'src/__tests__/skill-posture.test.ts';
let c5 = fs.readFileSync(p5, 'utf8');
c5 = c5.replace(
  `const strictlyAdvisory = [
      'ask',
      'clean-code',
      'code-review-checklist',
      'daily-standup',
      'weekly-leadership-report',
    ];`,
  `// eslint-disable-next-line @typescript-eslint/no-unused-vars
    const strictlyAdvisory = [
      'ask',
      'clean-code',
      'code-review-checklist',
      'daily-standup',
      'weekly-leadership-report',
    ];`
);
fs.writeFileSync(p5, c5, 'utf8');
