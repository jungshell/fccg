-- Add clickCount column to Gallery for per-item click tracking
ALTER TABLE "Gallery"
ADD COLUMN "clickCount" INTEGER NOT NULL DEFAULT 0;

