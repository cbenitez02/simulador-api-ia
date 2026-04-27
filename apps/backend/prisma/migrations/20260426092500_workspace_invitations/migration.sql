CREATE TABLE "WorkspaceInvitation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "invitedByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkspaceInvitation"
ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WorkspaceInvitation_workspaceId_status_createdAt_id_idx"
ON "WorkspaceInvitation"("workspaceId", "status", "createdAt" DESC, "id" DESC);

CREATE INDEX "WorkspaceInvitation_email_status_createdAt_id_idx"
ON "WorkspaceInvitation"("email", "status", "createdAt" DESC, "id" DESC);

CREATE UNIQUE INDEX "WorkspaceInvitation_pending_workspace_email_key"
ON "WorkspaceInvitation"("workspaceId", "email")
WHERE "status" = 'pending';
