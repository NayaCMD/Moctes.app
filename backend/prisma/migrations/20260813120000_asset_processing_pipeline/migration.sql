ALTER TYPE "AssetStatus" RENAME VALUE 'FAILED' TO 'REJECTED';
ALTER TYPE "AssetStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "AssetStatus" ADD VALUE 'QUARANTINED';

CREATE TYPE "AssetVariantKind" AS ENUM (
  'DISPLAY_WEBP',
  'DISPLAY_AVIF',
  'THUMBNAIL_WEBP',
  'THUMBNAIL_AVIF'
);

CREATE TYPE "AssetProcessingJobStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED'
);

ALTER TABLE "Asset"
ADD COLUMN "sourceObjectKey" TEXT,
ADD COLUMN "sourceMimeType" TEXT,
ADD COLUMN "detectedMimeType" TEXT,
ADD COLUMN "sourceSize" INTEGER,
ADD COLUMN "storageBytes" INTEGER,
ADD COLUMN "processingErrorCode" TEXT,
ADD COLUMN "processingErrorMessage" TEXT,
ADD COLUMN "processedAt" TIMESTAMP(3);

UPDATE "Asset"
SET
  "sourceMimeType" = "mimeType",
  "sourceSize" = "size",
  "storageBytes" = CASE WHEN "status" = 'REJECTED' THEN 0 ELSE "size" END;

ALTER TABLE "Asset"
ALTER COLUMN "sourceMimeType" SET NOT NULL,
ALTER COLUMN "sourceSize" SET NOT NULL,
ALTER COLUMN "storageBytes" SET NOT NULL;

CREATE UNIQUE INDEX "Asset_sourceObjectKey_key" ON "Asset"("sourceObjectKey");

CREATE TABLE "AssetVariant" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "kind" "AssetVariantKind" NOT NULL,
  "objectKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetVariant_objectKey_key" ON "AssetVariant"("objectKey");
CREATE UNIQUE INDEX "AssetVariant_assetId_kind_key" ON "AssetVariant"("assetId", "kind");
CREATE INDEX "AssetVariant_assetId_idx" ON "AssetVariant"("assetId");

CREATE TABLE "AssetProcessingJob" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "status" "AssetProcessingJobStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetProcessingJob_assetId_key" ON "AssetProcessingJob"("assetId");
CREATE INDEX "AssetProcessingJob_status_availableAt_idx" ON "AssetProcessingJob"("status", "availableAt");
CREATE INDEX "AssetProcessingJob_status_lockedAt_idx" ON "AssetProcessingJob"("status", "lockedAt");

ALTER TABLE "AssetVariant"
ADD CONSTRAINT "AssetVariant_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssetProcessingJob"
ADD CONSTRAINT "AssetProcessingJob_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
