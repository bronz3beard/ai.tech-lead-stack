import SkillForm from '@/components/skills/SkillForm';
import { authOptions } from '@/lib/auth';
import fs from 'fs/promises';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import path from 'path';

export default async function NewSkillPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  let initialTemplate = '';
  try {
    const templatePath = path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      'templates',
      'SKILL_TEMPLATE.md'
    );
    initialTemplate = await fs.readFile(templatePath, 'utf-8');
  } catch {
    // Provide a fallback template if the file is missing
    initialTemplate = `---
name: new-skill
description: Describe the skill here.
cost: ~10 tokens
modes: [read-only, write, mcp]
surface: public
# phase: intent | specify | plan | build | maintain | review | scale | deploy | polish
phase: build
# kind: skill | orchestrator | policy | report
kind: skill
# domain: eng | product | hiring | shared
domain: eng
# ownership:
ownership:
  drive: human # human | ai | human-ai
  approve: none # human | ai | none
# targets: local | subscription | api
targets: [local, subscription, api]
# minModelClass: small | mid | large
minModelClass: mid
# consumes: [artifact-types]
consumes: []
# emits: [artifact-types]
emits: []
# requires: [skill-names]
requires: []
# suggests: [skill-names]
suggests: []
# policies: [policy-names]
policies: []
---

# New Skill

## Runtime modes
Produces a verifiable implementation blueprint in read-only chat, and executes + verifies the implement phase in an IDE/MCP agent.

> [!IMPORTANT]
> All skills must follow the **G-Stack Methodology**: Diagnosis before Advice, and adhere to **MinimumCD** principles.

## Phase 0: Tech-Stack Discovery & Diagnosis
*Before providing any advice, list steps to diagnose the current state and tech stack.*

## Phase 1: Action & Implementation
*Describe the exact steps to implement the fix or feature.*

## MinimumCD & Quality Verification
*List the automated test strategies required to verify this skill's output.*
`;
  }

  return (
    <div className="container mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Precision Skill Forge
        </h1>
        <p className="mt-2 text-muted-foreground">
          Craft, validate, and submit new AI skills directly to the repository.
        </p>
      </div>

      <SkillForm initialTemplate={initialTemplate} />
    </div>
  );
}
