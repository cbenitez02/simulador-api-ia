ALTER TABLE "ApiLog"
ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'mock',
ADD COLUMN "scenarioName" TEXT;

DROP INDEX IF EXISTS "ApiLog_projectId_createdAt_idx";

CREATE INDEX "ApiLog_projectId_createdAt_id_idx"
ON "ApiLog"("projectId", "createdAt" DESC, "id" DESC);
