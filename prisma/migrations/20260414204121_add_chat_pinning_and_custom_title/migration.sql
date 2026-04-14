-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "isCustomTitle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false;
