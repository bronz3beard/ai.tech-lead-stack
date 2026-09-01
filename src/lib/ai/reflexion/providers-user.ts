import type { Project, User } from '@prisma/client';

import { MODELS } from '../constants';
import { createModel } from '@/lib/ai/model-registry';
import { buildRoleModel, keyFor, slotForModel } from '@/lib/ai/model-resolver';
import { validateDistinctModels } from '@/lib/ai/orchestrator';
import { decrypt } from '@/lib/crypto';

import type { LanguageModel } from 'ai';

import type { ReflexionRunner } from './engine';
import { buildRunner } from './providers-env';

/**
 * Website mode: model ids + keys come from the logged-in user (their per-role
 * routing and encrypted, stored keys), with per-project routing layered on top
 * via `project`. `decrypt` is injected into the resolver so this stays the only
 * place that reaches into crypto.
 *
 * Unlike before, the critic is no longer pinned to Claude — the user chooses each
 * responsibility's model. The distinctness guard still enforces planner != auditor
 * so the writer never grades its own work.
 *
 * This file is imported ONLY from server code (the API route), so the '@/' alias
 * resolves fine. It is never run under `tsx`.
 */
export function runnerFromUser(
  user: User,
  project?: Project | null
): ReflexionRunner {
  const ctx = { user, project, decrypt };

  const planner = buildRoleModel('planner', ctx);
  const auditor = buildRoleModel('auditor', ctx);
  const adjudicator = buildRoleModel('adjudicator', ctx);

  validateDistinctModels(planner.id, auditor.id);

  // Best-effort fixed fallback critic (see providers-env for rationale).
  let fallbackCritic: LanguageModel | undefined;
  try {
    fallbackCritic = createModel(
      MODELS.GEMINI_FALLBACK_CRITIC,
      keyFor('gemini', ctx)
    );
  } catch {
    fallbackCritic = undefined;
  }

  const plannerSlot = slotForModel(planner.id);
  let fallbackPlanner: LanguageModel | undefined;
  let fallbackPlannerId: string | undefined;
  const candidatePlanners = [
    { id: 'claude-haiku-4-5', slot: 'anthropic' as const },
    { id: 'gemini-3.6-flash', slot: 'gemini' as const },
    { id: 'gpt-5.4', slot: 'openai' as const }
  ];

  for (const { id, slot } of candidatePlanners) {
    if (slot === plannerSlot) continue;
    try {
      validateDistinctModels(id, auditor.id);
      fallbackPlanner = createModel(id, keyFor(slot, ctx));
      fallbackPlannerId = id;
      break;
    } catch {
      continue;
    }
  }

  return buildRunner(
    planner.model,
    auditor.model,
    adjudicator.model,
    { creator: planner.id, critic: auditor.id, adjudicator: adjudicator.id },
    fallbackCritic,
    (id: string) => createModel(id, keyFor(slotForModel(id), ctx)),
    fallbackPlanner,
    fallbackPlannerId
  );
}
