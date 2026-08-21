ALTER TABLE "Workspace"
ADD COLUMN "storageUsedBytes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "storageLimitBytes" INTEGER NOT NULL DEFAULT 104857600;

UPDATE "Workspace" AS workspace
SET "storageUsedBytes" = usage."usedBytes"
FROM (
    SELECT "workspaceId", COALESCE(SUM("size"), 0)::INTEGER AS "usedBytes"
    FROM "Asset"
    WHERE "status" IN ('PENDING', 'READY')
    GROUP BY "workspaceId"
) AS usage
WHERE workspace."id" = usage."workspaceId";

CREATE INDEX "Asset_status_uploadExpiresAt_idx"
ON "Asset"("status", "uploadExpiresAt");
