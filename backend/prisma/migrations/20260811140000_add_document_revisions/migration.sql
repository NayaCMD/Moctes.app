-- CreateTable
CREATE TABLE "DocumentRevision" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdById" TEXT,
    "restoredFromVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentRevision_pkey" PRIMARY KEY ("id")
);

-- Preserve the current state of documents created before revision history.
INSERT INTO "DocumentRevision" (
    "id",
    "documentId",
    "version",
    "title",
    "schemaVersion",
    "content",
    "createdById",
    "restoredFromVersion",
    "createdAt"
)
SELECT
    'backfill:' || "id" || ':v' || "version",
    "id",
    "version",
    "title",
    "schemaVersion",
    "content",
    NULL,
    NULL,
    "updatedAt"
FROM "Document";

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRevision_documentId_version_key" ON "DocumentRevision"("documentId", "version");
CREATE INDEX "DocumentRevision_documentId_createdAt_idx" ON "DocumentRevision"("documentId", "createdAt");
CREATE INDEX "DocumentRevision_createdById_idx" ON "DocumentRevision"("createdById");

-- AddForeignKey
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "DocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "DocumentRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
