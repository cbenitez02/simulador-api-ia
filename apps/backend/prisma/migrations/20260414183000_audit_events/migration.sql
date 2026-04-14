CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT,
    "actorDisplayName" TEXT,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_projectId_createdAt_id_idx" ON "AuditEvent"("projectId", "createdAt" DESC, "id" DESC);
CREATE INDEX "AuditEvent_projectId_resourceType_createdAt_id_idx" ON "AuditEvent"("projectId", "resourceType", "createdAt" DESC, "id" DESC);
CREATE INDEX "AuditEvent_projectId_action_createdAt_id_idx" ON "AuditEvent"("projectId", "action", "createdAt" DESC, "id" DESC);

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
