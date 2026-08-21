ALTER TABLE "Document"
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Document_workspaceId_deletedAt_updatedAt_idx"
ON "Document"("workspaceId", "deletedAt", "updatedAt");

ALTER TABLE "DocumentOperation"
ADD COLUMN "documentVersion" INTEGER;
