-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "projectName" TEXT;

-- CreateIndex
CREATE INDEX "AnalyticsEvent_projectName_createdAt_idx" ON "AnalyticsEvent"("projectName", "createdAt");
