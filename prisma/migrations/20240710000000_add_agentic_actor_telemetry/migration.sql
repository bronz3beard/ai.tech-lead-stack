-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "actorType" TEXT,
ADD COLUMN     "autonomy" TEXT,
ADD COLUMN     "loopPhase" TEXT,
ADD COLUMN     "loopRunId" TEXT,
ADD COLUMN     "teamRole" TEXT;

-- CreateIndex
CREATE INDEX "AnalyticsEvent_actorType_createdAt_idx" ON "AnalyticsEvent"("actorType", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_loopRunId_idx" ON "AnalyticsEvent"("loopRunId");
