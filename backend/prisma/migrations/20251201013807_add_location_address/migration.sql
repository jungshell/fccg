-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "locationAddress" TEXT;

-- AlterTable
ALTER TABLE "VideoViewStat" ALTER COLUMN "updatedAt" DROP DEFAULT;
