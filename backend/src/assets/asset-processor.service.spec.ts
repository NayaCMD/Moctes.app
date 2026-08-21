import { ConfigService } from '@nestjs/config';
import { AssetStatus, AssetVariantKind, type Asset } from '@prisma/client';
import sharp from 'sharp';
import { ObjectStorageService } from '../object-storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssetProcessingError,
  AssetProcessorService,
  detectImageMimeType,
} from './asset-processor.service';
import { ClamAvService } from './clamav.service';
import { SvgSanitizerService } from './svg-sanitizer.service';

describe('AssetProcessorService', () => {
  it('detects supported formats from their signatures instead of metadata', () => {
    expect(
      detectImageMimeType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('image/png');
    expect(detectImageMimeType(Buffer.from('GIF89a'))).toBe('image/gif');
    expect(
      detectImageMimeType(Buffer.from('<svg viewBox="0 0 1 1"></svg>')),
    ).toBe('image/svg+xml');
    expect(
      detectImageMimeType(Buffer.from('<html>not an image</html>')),
    ).toBeNull();
  });

  it('re-encodes a clean raster and persists WebP/AVIF display and thumbnail variants', async () => {
    const source = await sharp({
      create: {
        width: 4,
        height: 3,
        channels: 4,
        background: { r: 20, g: 40, b: 60, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const asset = processingAsset(source.length);
    const transaction = transactionMock(asset);
    const prisma = {
      asset: { findUnique: jest.fn().mockResolvedValue(asset) },
      $transaction: jest.fn(
        async (action: (value: typeof transaction) => Promise<unknown>) =>
          action(transaction),
      ),
    };
    const storage = {
      readObject: jest.fn().mockResolvedValue(source),
      writeObject: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const antivirus = {
      scan: jest.fn().mockResolvedValue({ status: 'clean', engine: 'clamav' }),
    };
    const processor = new AssetProcessorService(
      new ConfigService(),
      prisma as unknown as PrismaService,
      storage as unknown as ObjectStorageService,
      antivirus as unknown as ClamAvService,
      new SvgSanitizerService(),
    );

    const result = await processor.process(asset.id);

    expect(result).toMatchObject({
      assetId: asset.id,
      detectedMimeType: 'image/png',
      width: 4,
      height: 3,
    });
    expect(storage.writeObject).toHaveBeenCalledTimes(4);
    expect(readVariantKinds(transaction.captured.createMany)).toEqual([
      AssetVariantKind.DISPLAY_AVIF,
      AssetVariantKind.DISPLAY_WEBP,
      AssetVariantKind.THUMBNAIL_AVIF,
      AssetVariantKind.THUMBNAIL_WEBP,
    ]);
    expect(readUpdateData(transaction.captured.assetUpdate)).toMatchObject({
      status: AssetStatus.READY,
      mimeType: 'image/webp',
      sourceObjectKey: null,
    });
    expect(storage.deleteObject).toHaveBeenCalledWith(asset.sourceObjectKey);
  });

  it('quarantines an antivirus finding before decoding or writing output', async () => {
    const source = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: '#fff',
      },
    })
      .png()
      .toBuffer();
    const asset = processingAsset(source.length);
    const storage = {
      readObject: jest.fn().mockResolvedValue(source),
      writeObject: jest.fn(),
    };
    const processor = new AssetProcessorService(
      new ConfigService(),
      {
        asset: { findUnique: jest.fn().mockResolvedValue(asset) },
      } as unknown as PrismaService,
      storage as unknown as ObjectStorageService,
      {
        scan: jest.fn().mockResolvedValue({
          status: 'infected',
          engine: 'clamav',
          signature: 'Eicar-Test-Signature',
        }),
      } as unknown as ClamAvService,
      new SvgSanitizerService(),
    );

    await expect(processor.process(asset.id)).rejects.toMatchObject<
      Partial<AssetProcessingError>
    >({
      disposition: 'quarantined',
      code: 'MALWARE_DETECTED',
    });
    expect(storage.writeObject).not.toHaveBeenCalled();
  });
});

function processingAsset(sourceSize: number): Asset {
  const now = new Date();
  return {
    id: 'asset-1',
    workspaceId: 'workspace-1',
    uploadedById: 'user-1',
    folderId: 'folder-default-assets',
    type: 'image',
    name: 'Pixel',
    originalFilename: 'pixel.png',
    objectKey: 'quarantine/workspace-1/asset-1/source.png',
    sourceObjectKey: 'quarantine/workspace-1/asset-1/source.png',
    mimeType: 'image/png',
    sourceMimeType: 'image/png',
    detectedMimeType: null,
    size: sourceSize,
    sourceSize,
    storageBytes: sourceSize,
    width: null,
    height: null,
    status: AssetStatus.PROCESSING,
    processingErrorCode: null,
    processingErrorMessage: null,
    uploadExpiresAt: new Date(now.getTime() + 60_000),
    uploadedAt: now,
    processedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function transactionMock(asset: Asset) {
  const captured: { createMany?: unknown; assetUpdate?: unknown } = {};
  return {
    captured,
    asset: {
      findUnique: jest.fn().mockResolvedValue(asset),
      update: jest.fn((input: unknown) => {
        captured.assetUpdate = input;
        return Promise.resolve({});
      }),
    },
    workspace: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        storageUsedBytes: asset.storageBytes,
        storageLimitBytes: 100 * 1024 * 1024,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    assetVariant: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn((input: unknown) => {
        captured.createMany = input;
        return Promise.resolve({ count: 4 });
      }),
    },
  };
}

function readVariantKinds(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return [];
  }
  return value.data
    .map((entry) => (isRecord(entry) ? entry.kind : undefined))
    .filter((kind): kind is string => typeof kind === 'string')
    .sort();
}

function readUpdateData(value: unknown): Record<string, unknown> {
  return isRecord(value) && isRecord(value.data) ? value.data : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
