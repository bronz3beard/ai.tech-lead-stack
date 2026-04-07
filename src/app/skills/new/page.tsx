import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import fs from 'fs/promises';
import path from 'path';
import SkillForm from '@/components/skills/SkillForm';

export default async function NewSkillPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  let initialTemplate = '';
  try {
    const templatePath = path.join(process.cwd(), 'templates', 'SKILL_TEMPLATE.md');
    initialTemplate = await fs.readFile(templatePath, 'utf-8');
  } catch {
    // Provide a fallback template if the file is missing
    initialTemplate = `---
name: new-skill
description: Describe the skill here.
cost: ~tokens
---

# New Skill

> [!IMPORTANT]
> All skills must follow the **G-Stack Methodology**: Diagnosis before Advice.

## Phase 0: Tech-Stack Discovery & Diagnosis
*Before providing any advice, list steps to diagnose the current state and tech stack.*

## Phase 1: Action & Implementation
*Describe the exact steps to implement the fix or feature.*

## MinimumCD & Quality Verification
*List the automated test strategies required to verify this skill's output.*
`;
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Precision Skill Forge</h1>
        <p className="mt-2 text-muted-foreground">
          Craft, validate, and submit new AI skills directly to the repository.
        </p>
      </div>

      <SkillForm initialTemplate={initialTemplate} />
    </div>
  );
}
