-- Add login count tracking for activity analysis
ALTER TABLE "User" ADD COLUMN "loginCount" INTEGER NOT NULL DEFAULT 0;
