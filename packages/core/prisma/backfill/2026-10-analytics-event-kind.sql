-- Backfill AnalyticsEvent rows written before the `kind` column existed.
--
-- Run AFTER the code that writes `kind` is live (rows written in between by old
-- code are caught on the next run). Safe to run any number of times: every
-- statement only touches rows where kind IS NULL, and new code always sets kind.
--
--   cd packages/core
--   npx prisma db execute --file prisma/backfill/2026-10-analytics-event-kind.sql
--
-- What it does to legacy rows:
--   * MCP rows stored the skill file size (chars/4) as completionTokens next to a
--     fabricated 500 promptTokens. The size moves to promptTokens (what the agent
--     reads), completionTokens becomes 0.
--   * Every row that is not an LLM generation loses its fabricated totalCost
--     (the old figure stays in metadata.estimatedCost).
--   * Web-chat answers (analysis:*) were labelled AGENT/AUTONOMOUS; a person
--     asked each one, so they become HUMAN/DIRECTED.
--   * Rows the old Langfuse sync overwrote (metadata.isSynced) had their usage
--     replaced with zeros; duration, tokens and cost become NULL (unknown, not 0).
--   * provider, sessionId and environment are derived where possible.

BEGIN;

-- One-time snapshot of every column this script changes (kept on re-runs).
CREATE TABLE IF NOT EXISTS "AnalyticsEvent_bak_20261008" AS
SELECT id, kind, provider, "sessionId", environment, "actorType", autonomy,
       "promptTokens", "completionTokens", "totalTokens", "totalCost", duration
FROM "AnalyticsEvent";

-- 0. Usage the Langfuse sync overwrote with zeros is unknown, not zero.
UPDATE "AnalyticsEvent"
SET duration = NULL, "promptTokens" = NULL, "completionTokens" = NULL,
    "totalTokens" = NULL, "totalCost" = NULL
WHERE kind IS NULL AND metadata->>'isSynced' = 'true';

-- 1. MCP rows: the "completion" figure was the size of the served skill.
UPDATE "AnalyticsEvent"
SET "promptTokens" = COALESCE("completionTokens", 0),
    "completionTokens" = 0,
    "totalTokens" = COALESCE("completionTokens", 0)
WHERE kind IS NULL AND metadata->>'source' = 'mcp'
  AND COALESCE(metadata->>'isSynced', 'false') <> 'true';

-- 2. Web-chat answers were asked by a person.
UPDATE "AnalyticsEvent"
SET "actorType" = 'HUMAN', autonomy = 'DIRECTED'
WHERE kind IS NULL AND "skillName" LIKE 'analysis:%';

-- 3. Provider from the model id (same prefixes as model-registry.ts).
UPDATE "AnalyticsEvent"
SET provider = CASE
    WHEN model ~* '^claude' THEN 'anthropic'
    WHEN model ~* '^(gemini|jules|models/gemini)' THEN 'google'
    WHEN model ~* '^(gpt|o[1-9]|chatgpt)' THEN 'openai'
    ELSE NULL
  END
WHERE kind IS NULL AND provider IS NULL;

-- 4. Session: the chat or the reflexion run the row belonged to.
UPDATE "AnalyticsEvent"
SET "sessionId" = COALESCE(metadata->>'chatId', "loopRunId")
WHERE kind IS NULL AND "sessionId" IS NULL;

-- 5. Known test data: the sweep that used `dummy-skill` and model `test`.
UPDATE "AnalyticsEvent"
SET environment = 'test'
WHERE kind IS NULL
  AND ("skillName" = 'dummy-skill' OR model = 'test' OR metadata->>'invalidModel' = 'test');

-- 6. Classify (last, because it clears the kind IS NULL marker) and drop
--    fabricated cost from everything that is not an LLM generation.
WITH classified AS (
  SELECT e.id,
    CASE
      WHEN e.metadata->>'source' = 'mcp' THEN 'skill_invocation'
      WHEN e."skillName" LIKE 'analysis:%' THEN 'llm_generation'
      WHEN e."skillName" = 'reflexion-loop' AND COALESCE(e."totalTokens", 0) > 0 THEN 'llm_generation'
      WHEN e."skillName" = 'reflexion-loop' THEN 'loop_step'
      -- Chat get_skill calls were stored under the skill's name; other chat tools under the tool's.
      WHEN e.metadata->>'source' = 'chat-v2-execution'
        AND e."skillName" IN (SELECT DISTINCT "skillName" FROM "AnalyticsEvent" WHERE metadata->>'source' = 'mcp')
        THEN 'skill_invocation'
      WHEN e.metadata->>'source' IN ('chat-v2-execution', 'chat-ui') THEN 'tool_call'
      WHEN COALESCE(e."totalTokens", 0) > 0 AND COALESCE(e.metadata->>'llmCall', 'true') <> 'false' THEN 'llm_generation'
      ELSE 'skill_invocation'
    END AS k
  FROM "AnalyticsEvent" e
  WHERE e.kind IS NULL
)
UPDATE "AnalyticsEvent" e
SET kind = c.k,
    "totalCost" = CASE WHEN c.k = 'llm_generation' THEN e."totalCost" ELSE NULL END
FROM classified c
WHERE e.id = c.id;

COMMIT;

-- Rollback (manual; restores every column above from the snapshot):
-- BEGIN;
-- UPDATE "AnalyticsEvent" e
-- SET kind = b.kind, provider = b.provider, "sessionId" = b."sessionId",
--     environment = b.environment, "actorType" = b."actorType", autonomy = b.autonomy,
--     "promptTokens" = b."promptTokens", "completionTokens" = b."completionTokens",
--     "totalTokens" = b."totalTokens", "totalCost" = b."totalCost", duration = b.duration
-- FROM "AnalyticsEvent_bak_20261008" b
-- WHERE e.id = b.id;
-- COMMIT;
-- DROP TABLE "AnalyticsEvent_bak_20261008";  -- once satisfied either way
