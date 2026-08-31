import { validatePlanContract } from '/Users/bz3b/Desktop/repos/ai-dev/agent-toolbox/tech-lead-stack/src/lib/ai/reflexion/plan-contract';
import fs from 'fs';

const dl006 = fs.readFileSync('/Users/bz3b/Desktop/repos/ai-dev/agent-toolbox/tech-lead-stack/defect-library/plans/DL-006-too-many-loc.md', 'utf8');
const dl007 = fs.readFileSync('/Users/bz3b/Desktop/repos/ai-dev/agent-toolbox/tech-lead-stack/defect-library/plans/DL-007-golden-pass.md', 'utf8');

console.log("DL-006 violations:");
console.dir(validatePlanContract(dl006).violations, {depth: null});

console.log("\nDL-007 violations:");
console.dir(validatePlanContract(dl007).violations, {depth: null});
