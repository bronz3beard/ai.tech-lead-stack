-- ReflexionRun.intentPhase was added to schema.prisma in #101 without a
-- migration. IF NOT EXISTS keeps this safe on databases that already got the
-- column through `prisma db push`.

-- AlterTable
ALTER TABLE "ReflexionRun" ADD COLUMN IF NOT EXISTS "intentPhase" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexionRun_intentPhase_createdAt_idx" ON "ReflexionRun"("intentPhase", "createdAt");
