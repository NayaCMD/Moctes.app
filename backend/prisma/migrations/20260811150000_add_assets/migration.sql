CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "folderId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
    "uploadExpiresAt" TIMESTAMP(3) NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Asset_objectKey_key" ON "Asset"("objectKey");
CREATE INDEX "Asset_workspaceId_status_createdAt_idx" ON "Asset"("workspaceId", "status", "createdAt");
CREATE INDEX "Asset_uploadedById_idx" ON "Asset"("uploadedById");

ALTER TABLE "Asset"
ADD CONSTRAINT "Asset_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset"
ADD CONSTRAINT "Asset_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
