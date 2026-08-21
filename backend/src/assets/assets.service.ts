import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AssetStatus,
  AssetVariantKind,
  Prisma,
  type Asset as AssetRecord,
  type AssetVariant,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PoliciesService } from '../authorization/policies.service';
import { ObjectStorageService } from '../object-storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CreateAssetUploadDto,
  assetMimeTypes,
} from './dto/create-asset-upload.dto';
import {
  AssetObservabilityService,
  type AssetObservabilitySnapshot,
} from './asset-observability.service';
import { AssetProcessingQueueService } from './asset-processing-queue.service';

export interface AssetVariantResponse {
  kind: AssetVariantKind;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  downloadUrl: string;
  downloadExpiresAt: string;
}

export interface AssetResponse {
  id: string;
  workspaceId: string;
  folderId: string | null;
  type: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  sourceMimeType: string;
  detectedMimeType: string | null;
  size: number;
  sourceSize: number;
  storageBytes: number;
  width: number | null;
  height: number | null;
  status: AssetStatus;
  downloadUrl: string | null;
  downloadExpiresAt: string | null;
  thumbnailUrl: string | null;
  variants: AssetVariantResponse[];
  processingError: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetUploadResponse {
  asset: AssetResponse;
  upload: {
    url: string;
    method: 'PUT';
    headers: { 'Content-Type': string };
    expiresAt: string;
  };
}

export interface AssetUsageResponse {
  usedBytes: number;
  limitBytes: number;
  availableBytes: number;
  readyBytes: number;
  pendingBytes: number;
  quarantinedBytes: number;
  assetCount: number;
  assetLimit: number;
  observability: AssetObservabilitySnapshot;
}

export interface AssetListResponse {
  items: AssetResponse[];
  nextCursor: string | null;
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly storage: ObjectStorageService,
    private readonly observability: AssetObservabilityService,
    private readonly processingQueue: AssetProcessingQueueService,
  ) {}

  async list(
    userId: string,
    workspaceId: string,
    cursor?: string,
    requestedLimit?: string,
  ): Promise<AssetListResponse> {
    await this.policies.assertWorkspacePermission(
      userId,
      workspaceId,
      'asset:read',
    );
    const parsedLimit = Number(requestedLimit ?? 50);
    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;
    if (cursor) {
      const cursorAsset = await this.prisma.asset.findFirst({
        where: {
          id: cursor,
          workspaceId,
          status: { not: AssetStatus.PENDING },
        },
        select: { id: true },
      });
      if (!cursorAsset) {
        throw new BadRequestException('Invalid asset pagination cursor.');
      }
    }
    const assets = await this.prisma.asset.findMany({
      where: { workspaceId, status: { not: AssetStatus.PENDING } },
      include: { variants: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = assets.length > limit;
    const page = hasMore ? assets.slice(0, limit) : assets;
    return {
      items: await Promise.all(page.map((asset) => this.toResponse(asset))),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, id: string): Promise<AssetResponse> {
    await this.policies.assertAssetPermission(userId, id, 'asset:read');
    return this.toResponse(await this.findAsset(id));
  }

  async createUpload(
    userId: string,
    dto: CreateAssetUploadDto,
  ): Promise<AssetUploadResponse> {
    await this.policies.assertWorkspacePermission(
      userId,
      dto.workspaceId,
      'asset:create',
    );
    const id = randomUUID();
    const objectKey = `quarantine/${dto.workspaceId}/${id}/source.${extensionForMimeType(dto.mimeType)}`;
    const signedUpload = await this.storage.createUploadUrl(
      objectKey,
      dto.mimeType,
      dto.size,
    );
    const asset = await retrySerializableTransaction(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const workspace = await transaction.workspace.findUnique({
            where: { id: dto.workspaceId },
            select: {
              storageUsedBytes: true,
              storageLimitBytes: true,
              assetLimit: true,
            },
          });
          if (!workspace) {
            throw new NotFoundException(
              `Workspace ${dto.workspaceId} was not found.`,
            );
          }
          if (
            workspace.storageUsedBytes + dto.size >
            workspace.storageLimitBytes
          ) {
            this.observability.record(dto.workspaceId, 'quota_rejected', {
              requestedBytes: dto.size,
              usedBytes: workspace.storageUsedBytes,
              limitBytes: workspace.storageLimitBytes,
            });
            throw new PayloadTooLargeException({
              code: 'ASSET_STORAGE_QUOTA_EXCEEDED',
              message: 'The workspace storage quota has been reached.',
              requestedBytes: dto.size,
              usedBytes: workspace.storageUsedBytes,
              limitBytes: workspace.storageLimitBytes,
            });
          }
          const activeAssetCount = await transaction.asset.count({
            where: {
              workspaceId: dto.workspaceId,
              status: {
                in: [
                  AssetStatus.PENDING,
                  AssetStatus.PROCESSING,
                  AssetStatus.READY,
                  AssetStatus.QUARANTINED,
                ],
              },
            },
          });
          if (activeAssetCount >= workspace.assetLimit) {
            this.observability.record(dto.workspaceId, 'quota_rejected', {
              reason: 'asset_count',
              assetCount: activeAssetCount,
              assetLimit: workspace.assetLimit,
            });
            throw new PayloadTooLargeException({
              code: 'ASSET_COUNT_QUOTA_EXCEEDED',
              message: 'The workspace asset count quota has been reached.',
              assetCount: activeAssetCount,
              assetLimit: workspace.assetLimit,
            });
          }
          await transaction.workspace.update({
            where: { id: dto.workspaceId },
            data: { storageUsedBytes: { increment: dto.size } },
          });
          return transaction.asset.create({
            data: {
              id,
              workspaceId: dto.workspaceId,
              uploadedById: userId,
              folderId: dto.folderId,
              type: dto.type,
              name: dto.name.trim(),
              originalFilename: dto.originalFilename.slice(0, 255),
              objectKey,
              sourceObjectKey: objectKey,
              mimeType: dto.mimeType,
              sourceMimeType: dto.mimeType,
              size: dto.size,
              sourceSize: dto.size,
              storageBytes: dto.size,
              width: dto.width,
              height: dto.height,
              uploadExpiresAt: signedUpload.expiresAt,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    this.observability.record(dto.workspaceId, 'upload_ticket_created', {
      assetId: asset.id,
      size: asset.size,
      mimeType: asset.mimeType,
    });
    return {
      asset: await this.toResponse(asset),
      upload: {
        url: signedUpload.url,
        method: 'PUT',
        headers: { 'Content-Type': dto.mimeType },
        expiresAt: signedUpload.expiresAt.toISOString(),
      },
    };
  }

  async complete(userId: string, id: string): Promise<AssetResponse> {
    await this.policies.assertAssetPermission(userId, id, 'asset:create');
    const asset = await this.findAsset(id);
    if (asset.status === AssetStatus.READY) {
      return this.toResponse(asset);
    }
    if (asset.status === AssetStatus.PROCESSING) {
      return this.toResponse(asset);
    }
    if (
      asset.status === AssetStatus.REJECTED ||
      asset.status === AssetStatus.QUARANTINED
    ) {
      throw new ConflictException(
        'This asset upload can no longer be completed.',
      );
    }

    const uploadedObject = await this.storage.inspectObject(asset.objectKey);
    const uploadedMimeType = uploadedObject?.mimeType?.toLowerCase() ?? null;
    if (
      !uploadedObject ||
      uploadedObject.size !== asset.size ||
      uploadedMimeType !== asset.mimeType.toLowerCase()
    ) {
      await retrySerializableTransaction(() =>
        this.prisma.$transaction(
          async (transaction) => {
            const failed = await transaction.asset.updateMany({
              where: { id, status: AssetStatus.PENDING },
              data: {
                status: AssetStatus.REJECTED,
                sourceObjectKey: null,
                storageBytes: 0,
                processingErrorCode: 'UPLOAD_METADATA_MISMATCH',
                processingErrorMessage:
                  'O objeto enviado não corresponde ao upload declarado.',
                processedAt: new Date(),
              },
            });
            if (failed.count > 0) {
              await transaction.workspace.update({
                where: { id: asset.workspaceId },
                data: { storageUsedBytes: { decrement: asset.storageBytes } },
              });
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
      if (uploadedObject) {
        await this.storage.deleteObject(asset.objectKey).catch(() => undefined);
      }
      this.observability.record(asset.workspaceId, 'upload_rejected', {
        assetId: asset.id,
        declaredSize: asset.size,
        storedSize: uploadedObject?.size ?? null,
        declaredMimeType: asset.mimeType,
        storedMimeType: uploadedMimeType,
      });
      throw new UnprocessableEntityException(
        'The uploaded object does not match the declared file.',
      );
    }

    const promoted = await retrySerializableTransaction(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const result = await transaction.asset.updateMany({
            where: { id, status: AssetStatus.PENDING },
            data: { status: AssetStatus.PROCESSING, uploadedAt: new Date() },
          });
          if (result.count > 0) {
            await this.processingQueue.enqueue(transaction, id);
          }
          return result.count;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    if (promoted > 0) {
      this.observability.record(asset.workspaceId, 'upload_completed', {
        assetId: asset.id,
        size: asset.sourceSize,
        mimeType: asset.sourceMimeType,
        nextStatus: AssetStatus.PROCESSING,
      });
    }
    return this.toResponse(await this.findAsset(id));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.policies.assertAssetPermission(userId, id, 'asset:delete');
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!asset) {
      throw new NotFoundException(`Asset ${id} was not found.`);
    }
    const objectKeys = new Set([
      asset.objectKey,
      ...(asset.sourceObjectKey ? [asset.sourceObjectKey] : []),
      ...asset.variants.map((variant) => variant.objectKey),
    ]);
    await retrySerializableTransaction(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.asset.findUnique({
            where: { id },
          });
          if (!current) {
            throw new NotFoundException(`Asset ${id} was not found.`);
          }
          await transaction.asset.delete({ where: { id } });
          if (current.storageBytes > 0) {
            await transaction.workspace.update({
              where: { id: current.workspaceId },
              data: { storageUsedBytes: { decrement: current.storageBytes } },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    const deletionResults = await Promise.allSettled(
      [...objectKeys].map((objectKey) => this.storage.deleteObject(objectKey)),
    );
    this.observability.record(asset.workspaceId, 'asset_deleted', {
      assetId: asset.id,
      size: asset.size,
      status: asset.status,
      storageDeleteFailures: deletionResults.filter(
        (result) => result.status === 'rejected',
      ).length,
    });
  }

  async usage(
    userId: string,
    workspaceId: string,
  ): Promise<AssetUsageResponse> {
    await this.policies.assertWorkspacePermission(
      userId,
      workspaceId,
      'asset:read',
    );
    const [workspace, grouped] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          storageUsedBytes: true,
          storageLimitBytes: true,
          assetLimit: true,
        },
      }),
      this.prisma.asset.groupBy({
        by: ['status'],
        where: { workspaceId },
        _sum: { storageBytes: true },
        _count: { _all: true },
      }),
    ]);
    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} was not found.`);
    }
    const ready = grouped.find((entry) => entry.status === AssetStatus.READY);
    const pending = grouped.find(
      (entry) => entry.status === AssetStatus.PENDING,
    );
    const processing = grouped.find(
      (entry) => entry.status === AssetStatus.PROCESSING,
    );
    const quarantined = grouped.find(
      (entry) => entry.status === AssetStatus.QUARANTINED,
    );
    return {
      usedBytes: workspace.storageUsedBytes,
      limitBytes: workspace.storageLimitBytes,
      availableBytes: Math.max(
        0,
        workspace.storageLimitBytes - workspace.storageUsedBytes,
      ),
      readyBytes: ready?._sum.storageBytes ?? 0,
      pendingBytes:
        (pending?._sum.storageBytes ?? 0) +
        (processing?._sum.storageBytes ?? 0),
      quarantinedBytes: quarantined?._sum.storageBytes ?? 0,
      assetCount: grouped
        .filter((entry) => entry.status !== AssetStatus.REJECTED)
        .reduce((count, entry) => count + entry._count._all, 0),
      assetLimit: workspace.assetLimit,
      observability: this.observability.snapshot(workspaceId),
    };
  }

  private async findAsset(id: string): Promise<AssetRecord> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Asset ${id} was not found.`);
    }
    return asset;
  }

  private async toResponse(
    asset: AssetRecord & { variants?: AssetVariant[] },
  ): Promise<AssetResponse> {
    const storedVariants =
      asset.variants ??
      (asset.status === AssetStatus.READY
        ? await this.prisma.assetVariant.findMany({
            where: { assetId: asset.id },
            orderBy: { kind: 'asc' },
          })
        : []);
    const download =
      asset.status === AssetStatus.READY
        ? await this.storage.createDownloadUrl(
            asset.objectKey,
            asset.originalFilename,
          )
        : null;
    const variants =
      asset.status === AssetStatus.READY
        ? await Promise.all(
            storedVariants.map(async (variant) => {
              const signed = await this.storage.createDownloadUrl(
                variant.objectKey,
                variantFilename(asset.originalFilename, variant),
              );
              return {
                kind: variant.kind,
                mimeType: variant.mimeType,
                size: variant.size,
                width: variant.width,
                height: variant.height,
                downloadUrl: signed.url,
                downloadExpiresAt: signed.expiresAt.toISOString(),
              };
            }),
          )
        : [];
    const thumbnailUrl =
      variants.find(
        (variant) => variant.kind === AssetVariantKind.THUMBNAIL_WEBP,
      )?.downloadUrl ?? null;
    return {
      id: asset.id,
      workspaceId: asset.workspaceId,
      folderId: asset.folderId,
      type: asset.type,
      name: asset.name,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sourceMimeType: asset.sourceMimeType,
      detectedMimeType: asset.detectedMimeType,
      size: asset.size,
      sourceSize: asset.sourceSize,
      storageBytes: asset.storageBytes,
      width: asset.width,
      height: asset.height,
      status: asset.status,
      downloadUrl: download?.url ?? null,
      downloadExpiresAt: download?.expiresAt.toISOString() ?? null,
      thumbnailUrl,
      variants,
      processingError:
        asset.processingErrorCode && asset.processingErrorMessage
          ? {
              code: asset.processingErrorCode,
              message: asset.processingErrorMessage,
            }
          : null,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }
}

function variantFilename(
  originalFilename: string,
  variant: Pick<AssetVariant, 'kind' | 'mimeType'>,
): string {
  const base =
    originalFilename.replace(/\.[^.]+$/, '').slice(0, 160) || 'asset';
  const suffix = variant.kind.toLowerCase().replaceAll('_', '-');
  return `${base}-${suffix}.${variant.mimeType === 'image/avif' ? 'avif' : 'webp'}`;
}

async function retrySerializableTransaction<T>(
  action: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 3) {
        throw error;
      }
    }
  }
  throw new Error('The asset transaction could not be completed.');
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

function extensionForMimeType(
  mimeType: (typeof assetMimeTypes)[number],
): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
  }
}
