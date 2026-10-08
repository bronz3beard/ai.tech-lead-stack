-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "kind" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "gitBranch" TEXT,
ADD COLUMN     "prNumber" INTEGER,
ADD COLUMN     "cacheReadTokens" INTEGER,
ADD COLUMN     "cacheWriteTokens" INTEGER,
ADD COLUMN     "reasoningTokens" INTEGER,
ADD COLUMN     "costIsEstimate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "environment" TEXT NOT NULL DEFAULT 'production';

-- CreateIndex
CREATE INDEX "AnalyticsEvent_environment_kind_createdAt_idx" ON "AnalyticsEvent"("environment", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_provider_createdAt_idx" ON "AnalyticsEvent"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_projectName_kind_createdAt_idx" ON "AnalyticsEvent"("projectName", "kind", "createdAt");
