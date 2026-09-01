/**
 *
 * Decides WHICH model plays each responsibility and builds the client for it,
 * on top of the provider-agnostic factory in ./model-registry.
 *
 * Responsibilities (ratified): planner | implementer | auditor | adjudicator.
 *   - planner      → produces the plan/blueprint          (reflexion "creator")
 *   - implementer  → writes the code in the sandbox       (orchestrator/MCP write path)
 *   - auditor      → reviews / critiques, must differ     (reflexion "critic")
 *   - adjudicator  → final verdict in the reflexion loop
 *
 * Precedence (highest wins):
 *   1. Project-scoped ENV VARS   — a project's .env is the deployment source of truth
 *   2. Project.settings.modelRouting[role]  — per-project override editable from the web app
 *   3. User.settings.modelRouting[role]     — user defaults (Phase B4; read defensively)
 *   4. Legacy single-column prefs (requirementsModel / auditModel) — back-compat
 *   5. System default (MODELS.*)
 *
 * tsx-SAFE: this module is imported by runnerFromEnv(), which runs under tsx in
 * scripts/reflexion-loop.ts. Therefore NO '@/' path alias, and NO import of
 * '@/lib/crypto'. `decrypt` is INJECTED via ctx (same DI pattern the existing
 * resolveGeminiApiKeys/resolveJulesApiKeys helpers use). Server callers pass the
 * real decrypt; headless callers pass nothing and get env keys.
 */
import type { Project, User } from '@prisma/client';
import type { LanguageModel } from 'ai';

import { MODELS } from './constants';
import { catalogEntry, createModel, providerOf } from './model-registry';

export type Responsibility =
  | 'planner'
  | 'implementer'
  | 'auditor'
  | 'adjudicator';
export type KeySlot = 'anthropic' | 'gemini' | 'openai' | 'jules';

/** Adapter mapping legacy Reflexion vocabulary to the unified Responsibility taxonomy */
export function toResponsibility(role: 'creator' | 'critic' | 'adjudicator'): Responsibility {
  if (role === 'creator') return 'planner';
  if (role === 'critic') return 'auditor';
  return role;
}

export interface ResolveCtx {
  user?: User | null;
  project?: Project | null;
  /** Injected on the server path; omitted headless (env keys aren't encrypted). */
  decrypt?: (ciphertext: string) => string;
}

/** Env vars checked per role, in order. Legacy names kept for back-compat. */
const ENV_BY_ROLE: Record<Responsibility, string[]> = {
  planner: [
    'MODEL_PLANNER',
    'REFLEXION_CREATOR_MODEL',
    'REQUIREMENTS_DEVELOPMENT_MODEL',
  ],
  implementer: ['MODEL_IMPLEMENTER'],
  auditor: ['MODEL_AUDITOR', 'REFLEXION_CRITIC_MODEL', 'CODE_AUDIT_MODEL'],
  adjudicator: ['MODEL_ADJUDICATOR', 'REFLEXION_ADJUDICATOR_MODEL'],
};

/**
 * System defaults. NOTE: `auditor` defaults to Claude — this unifies the reflexion
 * critic (was MODELS.CLAUDE) and the orchestrator auditor (was legacy 'jules').
 * If you want the old orchestrator behaviour, set CODE_AUDIT_MODEL=jules or an
 * auditor entry in project/user routing.
 */
const SYSTEM_DEFAULT: Record<Responsibility, string> = {
  planner: MODELS.GEMINI,
  implementer: MODELS.GEMINI,
  auditor: MODELS.CLAUDE,
  adjudicator: MODELS.CLAUDE,
};

type RoutingMap = Partial<Record<Responsibility, string>>;

/** Map a legacy symbolic family to a concrete id; pass concrete ids through. */
export function normalizeLegacy(value: string): string {
  switch (value) {
    case 'gemini':
      return MODELS.GEMINI;
    case 'claude':
      return MODELS.CLAUDE;
    case 'openai':
      return MODELS.OPENAI;
    case 'jules':
      return MODELS.JULES;
    default:
      return value; // already a concrete id (the expanded UI stores concrete ids)
  }
}

export type ModelSource = 'env' | 'project' | 'user' | 'default';

export interface ResolvedModel {
  id: string;
  source: ModelSource;
}

/** Resolve the model id and reporting source layer for a responsibility. */
export function resolveModelWithSource(
  role: Responsibility,
  ctx: ResolveCtx = {}
): ResolvedModel {
  // 1. Project-scoped env vars (deployment source of truth).
  for (const key of ENV_BY_ROLE[role]) {
    const v = process.env[key]?.trim();
    if (v) return { id: normalizeLegacy(v), source: 'env' };
  }

  // 2. Per-project routing stored in Project.settings.modelRouting.
  const projectRouting = (
    ctx.project?.settings as unknown as
      | { modelRouting?: RoutingMap }
      | null
      | undefined
  )?.modelRouting;
  if (projectRouting?.[role]) {
    return { id: normalizeLegacy(projectRouting[role]!), source: 'project' };
  }

  // 3. Per-user routing (User.settings.modelRouting).
  const userRouting = (
    ctx.user?.settings as unknown as
      | { modelRouting?: RoutingMap }
      | null
      | undefined
  )?.modelRouting;
  if (userRouting?.[role]) {
    return { id: normalizeLegacy(userRouting[role]!), source: 'user' };
  }

  // 4. Legacy single-column prefs (the original two-dropdown UI).
  if (role === 'planner' && ctx.user?.requirementsModel) {
    return { id: normalizeLegacy(ctx.user.requirementsModel), source: 'user' };
  }
  if (role === 'auditor' && ctx.user?.auditModel) {
    return { id: normalizeLegacy(ctx.user.auditModel), source: 'user' };
  }

  // 5. System default.
  return { id: SYSTEM_DEFAULT[role], source: 'default' };
}

/** Resolve the concrete model id for a responsibility, applying the precedence chain. */
export function resolveModelId(
  role: Responsibility,
  ctx: ResolveCtx = {}
): string {
  return resolveModelWithSource(role, ctx).id;
}

/* ------------------------------------------------------------------ *
 * Key selection — mirrors resolveGeminiApiKeys / resolveJulesApiKeys  *
 * behaviour without importing them (keeps this module tsx-safe).      *
 * ------------------------------------------------------------------ */

function envGeminiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    undefined
  );
}

function decryptStored(
  cipher: string | null | undefined,
  decrypt?: ResolveCtx['decrypt']
): string | undefined {
  const c = cipher?.trim();
  if (!c || !decrypt) return undefined;
  try {
    const k = decrypt(c).trim();
    return k || undefined;
  } catch {
    // Swallow here; the caller throws a friendly error if nothing resolves.
    return undefined;
  }
}

/** Resolve the API key for a given key slot, preferring the user's stored key. */
export function keyFor(slot: KeySlot, ctx: ResolveCtx = {}): string {
  const { user, decrypt } = ctx;

  switch (slot) {
    case 'anthropic': {
      const key =
        decryptStored(user?.claudeApiKey, decrypt) ??
        process.env.ANTHROPIC_API_KEY?.trim();
      if (key) return key;
      throw new Error(
        'No Claude/Anthropic API key. Add one in Settings or set ANTHROPIC_API_KEY.'
      );
    }
    case 'openai': {
      const key =
        decryptStored(user?.openaiApiKey, decrypt) ??
        process.env.OPENAI_API_KEY?.trim();
      if (key) return key;
      throw new Error(
        'No OpenAI API key. Add one in Settings or set OPENAI_API_KEY.'
      );
    }
    case 'jules': {
      // Jules: DB first, then env (matches resolveJulesApiKeys — no precedence toggle).
      const key =
        decryptStored(user?.julesApiKey, decrypt) ??
        process.env.JULES_API_KEY?.trim();
      if (key) return key;
      throw new Error(
        'No Jules API key. Add one in Settings or set JULES_API_KEY.'
      );
    }
    case 'gemini':
    default: {
      // Gemini: honour GEMINI_API_KEY_PRECEDENCE=env (matches resolveGeminiApiKeys).
      const dbKey = decryptStored(user?.geminiApiKey, decrypt);
      const envKey = envGeminiKey();
      const preferEnv =
        process.env.GEMINI_API_KEY_PRECEDENCE?.trim().toLowerCase() === 'env';
      const key = preferEnv ? (envKey ?? dbKey) : (dbKey ?? envKey);
      if (key) return key;
      throw new Error(
        'No Gemini API key. Add one in Settings or set GEMINI_API_KEY.'
      );
    }
  }
}

/** Pick the key slot for a model id: catalog first, else infer from provider family. */
export function slotForModel(id: string): KeySlot {
  const entry = catalogEntry(id);
  if (entry) return entry.keySlot;
  const family = providerOf(id); // throws on unknown ids — surfaces bad config early
  return family === 'anthropic'
    ? 'anthropic'
    : family === 'openai'
      ? 'openai'
      : 'gemini';
}

/**
 * Resolve a responsibility to both its concrete id and a ready LanguageModel.
 * The id is returned alongside the model because buildRunner needs it for the
 * PRICE_PER_MTOK cost lookup.
 */
export function buildRoleModel(
  role: Responsibility,
  ctx: ResolveCtx = {}
): { id: string; model: LanguageModel } {
  const id = resolveModelId(role, ctx);
  const model = createModel(id, keyFor(slotForModel(id), ctx));
  return { id, model };
}

/** Guard: two responsibilities must use different models (e.g. writer vs grader). */
export function assertDistinctModels(
  a: string,
  b: string,
  labelA = 'planner',
  labelB = 'auditor'
): void {
  if (a === b) {
    throw new Error(
      `The ${labelA} model (${a}) and the ${labelB} model (${b}) must be distinct so the writer never grades its own work.`
    );
  }
}
