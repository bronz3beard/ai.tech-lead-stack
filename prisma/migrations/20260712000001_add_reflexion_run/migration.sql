-- CreateTable
CREATE TABLE "ReflexionRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "brief" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stateJson" JSONB NOT NULL,
    "latestScore" DOUBLE PRECISION,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReflexionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReflexionRun_userId_updatedAt_idx" ON "ReflexionRun"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ReflexionRun" ADD CONSTRAINT "ReflexionRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
