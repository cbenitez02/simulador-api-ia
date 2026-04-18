CREATE TABLE "ProjectSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT NOT NULL,
    "createdByEmail" TEXT,
    "createdByDisplayName" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectSnapshot_projectId_createdAt_id_idx"
ON "ProjectSnapshot"("projectId", "createdAt" DESC, "id" DESC);

ALTER TABLE "ProjectSnapshot"
ADD CONSTRAINT "ProjectSnapshot_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
