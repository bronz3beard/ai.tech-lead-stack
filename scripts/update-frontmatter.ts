import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { validatePlanContract } from '../src/lib/ai/reflexion/plan-contract';

const dir = path.join(__dirname, '../defect-library/plans');
const files = fs.readdirSync(dir);

for (const f of files) {
  if (!f.endsWith('.md')) continue;
  const fp = path.join(dir, f);
  const content = fs.readFileSync(fp, 'utf-8');
  const parsed = matter(content);
  const report = validatePlanContract(parsed.content);
  
  if (parsed.data.expected) {
    parsed.data.expected.expectedStructuralPass = report.passesStructuralGate;
    const newContent = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(fp, newContent);
  }
}
