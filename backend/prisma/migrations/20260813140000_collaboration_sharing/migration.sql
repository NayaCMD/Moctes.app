CREATE TYPE "WorkspaceInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

ALTER TABLE "Document"
ADD COLUMN "collaborationSequence" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WorkspaceInvitation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL,
  "status" "WorkspaceInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "tokenHash" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentShareLink" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentShareLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentOperation" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "operationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "baseSequence" INTEGER NOT NULL,
  "patches" JSONB NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");
CREATE INDEX "WorkspaceInvitation_workspaceId_status_createdAt_idx" ON "WorkspaceInvitation"("workspaceId", "status", "createdAt");
CREATE INDEX "WorkspaceInvitation_email_status_idx" ON "WorkspaceInvitation"("email", "status");
CREATE UNIQUE INDEX "DocumentShareLink_tokenHash_key" ON "DocumentShareLink"("tokenHash");
CREATE INDEX "DocumentShareLink_documentId_revokedAt_createdAt_idx" ON "DocumentShareLink"("documentId", "revokedAt", "createdAt");
CREATE UNIQUE INDEX "DocumentOperation_documentId_sequence_key" ON "DocumentOperation"("documentId", "sequence");
CREATE UNIQUE INDEX "DocumentOperation_documentId_operationId_key" ON "DocumentOperation"("documentId", "operationId");
CREATE INDEX "DocumentOperation_documentId_createdAt_idx" ON "DocumentOperation"("documentId", "createdAt");
CREATE INDEX "DocumentOperation_actorId_idx" ON "DocumentOperation"("actorId");

ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentShareLink" ADD CONSTRAINT "DocumentShareLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentShareLink" ADD CONSTRAINT "DocumentShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentOperation" ADD CONSTRAINT "DocumentOperation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentOperation" ADD CONSTRAINT "DocumentOperation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
