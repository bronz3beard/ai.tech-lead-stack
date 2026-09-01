-- DropIndex
DROP INDEX "ProjectAccess_projectId_role_key";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "settings" JSONB;

-- AlterTable
ALTER TABLE "ProjectAccess" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "role" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "auditModel" TEXT,
ADD COLUMN     "e2bApiKey" TEXT,
ADD COLUMN     "julesApiKey" TEXT,
ADD COLUMN     "requirementsModel" TEXT;

-- CreateIndex
CREATE INDEX "ProjectAccess_projectId_idx" ON "ProjectAccess"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAccess_userId_idx" ON "ProjectAccess"("userId");

-- AddForeignKey
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
