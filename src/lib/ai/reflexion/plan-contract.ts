import { z } from 'zod';

export type PlanContractViolation = {
  pillar: 'gstackDiagnosis' | 'atomicBatches' | 'productionEthos' | 'modernWeb';
  severity: 'fatal' | 'warn';
  message: string;
  locus: string;
};

export type PlanContractTask = {
  index: number;
  hasVerificationGate: boolean;
  declaredLocClaim: boolean;
  bigBangSignals: string[];
};

export const PlanContractReportSchema = z.object({
  hasPhase0: z.boolean(),
  tasks: z.array(
    z.object({
      index: z.number(),
      hasVerificationGate: z.boolean(),
      declaredLocClaim: z.boolean(),
      bigBangSignals: z.array(z.string()),
    })
  ),
  violations: z.array(
    z.object({
      pillar: z.enum([
        'gstackDiagnosis',
        'atomicBatches',
        'productionEthos',
        'modernWeb',
      ]),
      severity: z.enum(['fatal', 'warn']),
      message: z.string(),
      locus: z.string(),
    })
  ),
  passesStructuralGate: z.boolean(),
});

export type PlanContractReport = z.infer<typeof PlanContractReportSchema>;

export function validatePlanContract(planMarkdown: string): PlanContractReport {
  const violations: PlanContractViolation[] = [];
  const tasks: PlanContractTask[] = [];
  let hasPhase0 = false;

  // 1. gstackDiagnosis (fatal)
  const phase0Regex = /## Phase 0[\s\S]*?((?:##|$))/i;
  const phase0Match = phase0Regex.exec(planMarkdown);

  if (phase0Match) {
    hasPhase0 = true;
    const phase0Content = phase0Match[0];
    const techKeywords = [
      'language',
      'framework',
      'package.json',
      'tsconfig',
      'dependency',
      'next.js',
      'react',
      'node',
      'typescript',
      'tailwind',
      'prisma',
    ];
    const hasTech = techKeywords.some((kw) =>
      phase0Content.toLowerCase().includes(kw)
    );
    if (!hasTech) {
      violations.push({
        pillar: 'gstackDiagnosis',
        severity: 'fatal',
        message:
          'Phase 0 section is present but appears to be empty or generic. It must mention the language, framework, package.json, or specific stack details.',
        locus: 'Phase 0 - Stack Diagnosis',
      });
    }
  } else {
    violations.push({
      pillar: 'gstackDiagnosis',
      severity: 'fatal',
      message:
        'Missing "## Phase 0 - Stack Diagnosis" section. The plan must explicitly state the detected stack.',
      locus: 'Global',
    });
  }

  // 2. productionEthos (fatal) - Plan level Risks & Verification
  const risksRegex = /## Risks & Verification[\s\S]*?((?:##|$))/i;
  const risksMatch = risksRegex.exec(planMarkdown);
  if (!risksMatch) {
    violations.push({
      pillar: 'productionEthos',
      severity: 'fatal',
      message: 'Missing "## Risks & Verification" section.',
      locus: 'Global',
    });
  }

  // Extract tasks from Atomic Task List
  const tasksRegex = /## Atomic Task List\s*([\s\S]*?)\s*(?=##|$)/i;
  const tasksMatch = tasksRegex.exec(planMarkdown);

  if (tasksMatch) {
    const taskListContent = tasksMatch[1];
    
    // Split by numbered list e.g., "1. ", "2. "
    const taskChunks = taskListContent.split(/(?:^|\n)\d+\.\s+/).filter(c => c.trim().length > 0);
    
    taskChunks.forEach((chunk, idx) => {
      const taskIndex = idx + 1;
      const bigBangSignals: string[] = [];
      let hasVerificationGate = false;
      let declaredLocClaim = false;

      // Extract file paths
      const filePathsRegex = /(?:`([a-zA-Z0-9_\-\/\.]+\.(?:ts|tsx|js|py|jsx|css|scss|md|prisma))`)|\b([a-zA-Z0-9_\-\/\.]+\.(?:ts|tsx|js|py|jsx|css|scss|prisma))\b/gi;
      const paths = [...chunk.matchAll(filePathsRegex)].map(m => m[1] || m[2]);
      // Remove duplicates and normalise
      const uniquePaths = Array.from(new Set(paths.map(p => p.toLowerCase())));

      if (uniquePaths.length >= 3) {
        bigBangSignals.push(`Mentions >= 3 files: ${uniquePaths.slice(0,3).join(', ')}`);
      }
      
      const andChaining = /(create|edit|modify|add)[^.]*? and /i.test(chunk);
      if (andChaining && uniquePaths.length >= 2) {
         const hasTestFile = uniquePaths.some(p => p.includes('.test.') || p.includes('.spec.'));
         if (!(uniquePaths.length === 2 && hasTestFile)) {
             bigBangSignals.push(`Mentions "and" chaining file edits.`);
         }
      }

      if (bigBangSignals.length > 0) {
        violations.push({
          pillar: 'atomicBatches',
          severity: 'fatal',
          message: `Task ${taskIndex} appears to be a "big bang" step combining too many changes: ${bigBangSignals.join(' ')}. Split this task into smaller atomic slices.`,
          locus: `Task ${taskIndex}`,
        });
      }

      // Check LOC claim
      if (/<\s*100\s*(LOC|lines)/i.test(chunk)) {
        declaredLocClaim = true;
        // warn if it lacks concrete files
        if (uniquePaths.length === 0) {
           violations.push({
             pillar: 'atomicBatches',
             severity: 'warn',
             message: `Task ${taskIndex} claims <100 LOC but doesn't mention any concrete file scope.`,
             locus: `Task ${taskIndex}`,
           });
        }
      }

      // Check components count
      const componentsCount = (chunk.match(/components?\/[a-zA-Z0-9_]+/gi) || []).length;
      if (componentsCount >= 4 || /around \d{3,}\s+lines/i.test(chunk)) {
         violations.push({
           pillar: 'atomicBatches',
           severity: 'warn',
           message: `Task ${taskIndex} might exceed 100 LOC (creates 4+ components or explicitly mentions many lines).`,
           locus: `Task ${taskIndex}`,
         });
      }

      // Check Verification
      if (/Verification:/i.test(chunk)) {
         hasVerificationGate = true;
         const verificationLineMatch = /Verification:([^\n]*)/i.exec(chunk);
         const verificationText = verificationLineMatch ? verificationLineMatch[1] : chunk;
         
         const runnableTokens = ['npm', 'pnpm', 'tsc', 'jest', 'curl', 'run', 'npx'];
         const hasRunnableToken = runnableTokens.some(t => verificationText.toLowerCase().includes(t));
         const isFake = /(looks correct|seems right|assumed to pass|tested manually)/i.test(verificationText);

         if (!hasRunnableToken || isFake) {
           violations.push({
             pillar: 'productionEthos',
             severity: 'fatal',
             message: `Task ${taskIndex} has a fake or missing verification command. Must include a runnable token (npm, tsc, jest, curl, etc.) and evidence.`,
             locus: `Task ${taskIndex}`,
           });
         }
      } else {
         violations.push({
             pillar: 'productionEthos',
             severity: 'fatal',
             message: `Task ${taskIndex} is missing a "Verification:" step.`,
             locus: `Task ${taskIndex}`,
         });
      }

      tasks.push({
        index: taskIndex,
        hasVerificationGate,
        declaredLocClaim,
        bigBangSignals,
      });
    });
  } else {
    violations.push({
      pillar: 'atomicBatches',
      severity: 'fatal',
      message: 'Missing "## Atomic Task List" section.',
      locus: 'Global',
    });
  }

  // 5. modernWeb (warn)
  if (/document\.execCommand/i.test(planMarkdown)) {
    violations.push({
      pillar: 'modernWeb',
      severity: 'warn',
      message: 'Plan uses deprecated legacy web API: document.execCommand. Suggest modern equivalent (e.g., Clipboard API).',
      locus: 'Global',
    });
  }

  const passesStructuralGate = !violations.some(v => v.severity === 'fatal');

  return {
    hasPhase0,
    tasks,
    violations,
    passesStructuralGate,
  };
}
