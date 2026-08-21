import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetStatus, Prisma } from '@prisma/client';
import { ObjectStorageService } from '../object-storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssetObservabilityService } from './asset-observability.service';

export interface AssetCleanupResult {
  deletedRecords: number;
  deletedOrphans: number;
}

@Injectable()
export class AssetMaintenanceService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly cleanupIntervalMs: number;
  private readonly pendingGraceMs: number;
  private readonly rejectedRetentionMs: number;
  private readonly quarantineRetentionMs: number;
  private readonly orphanGraceMs: number;
  private readonly batchSize: number;
  private interval: ReturnType<typeof setInterval> | null = null;
  private running: Promise<AssetCleanupResult> | null = null;
  private readonly orphanScanCursors = new Map<string, string | undefined>();

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly observability: AssetObservabilityService,
  ) {
    this.cleanupIntervalMs = seconds(
      config.get<string>('ASSET_CLEANUP_INTERVAL_SECONDS'),
      900,
    );
    this.pendingGraceMs = seconds(
      config.get<string>('ASSET_PENDING_CLEANUP_GRACE_SECONDS'),
      300,
    );
    this.rejectedRetentionMs = seconds(
      config.get<string>('ASSET_REJECTED_RETENTION_SECONDS'),
      86_400,
    );
    this.quarantineRetentionMs = seconds(
      config.get<string>('ASSET_QUARANTINE_RETENTION_SECONDS'),
      604_800,
    );
    this.orphanGraceMs = seconds(
      config.get<string>('ASSET_ORPHAN_CLEANUP_GRACE_SECONDS'),
      86_400,
    );
    this.batchSize = positiveInteger(
      config.get<string>('ASSET_CLEANUP_BATCH_SIZE'),
      200,
    );
  }

  onApplicationBootstrap(): void {
    void this.runCleanup().catch(() => undefined);
    this.interval = setInterval(() => {
      void this.runCleanup().catch(() => undefined);
    }, this.cleanupIntervalMs);
    this.interval.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  runCleanup(): Promise<AssetCleanupResult> {
    this.running ??= this.executeCleanup().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async executeCleanup(): Promise<AssetCleanupResult> {
    let deletedRecords = 0;
    let deletedOrphans = 0;
    try {
      const now = Date.now();
      const candidates = await this.prisma.asset.findMany({
        where: {
          OR: [
            {
              status: AssetStatus.PENDING,
              uploadExpiresAt: {
                lt: new Date(now - this.pendingGraceMs),
              },
            },
            {
              status: AssetStatus.REJECTED,
              updatedAt: { lt: new Date(now - this.rejectedRetentionMs) },
            },
            {
              status: AssetStatus.QUARANTINED,
              updatedAt: { lt: new Date(now - this.quarantineRetentionMs) },
            },
          ],
        },
        orderBy: { updatedAt: 'asc' },
        take: this.batchSize,
      });

      for (const candidate of candidates) {
        const withVariants = await this.prisma.asset.findUnique({
          where: { id: candidate.id },
          include: { variants: true },
        });
        const keys = new Set([
          candidate.objectKey,
          ...(candidate.sourceObjectKey ? [candidate.sourceObjectKey] : []),
          ...(withVariants?.variants.map((variant) => variant.objectKey) ?? []),
        ]);
        const deleted = await this.deleteRecordAndReleaseQuota(candidate.id);
        deletedRecords += deleted;
        if (deleted > 0) {
          await Promise.allSettled(
            [...keys].map((key) => this.storage.deleteObject(key)),
          );
        }
      }

      for (const prefix of ['assets/', 'quarantine/']) {
        const listed = await this.storage.listObjects(
          prefix,
          this.batchSize,
          this.orphanScanCursors.get(prefix),
        );
        this.orphanScanCursors.set(
          prefix,
          listed.length === this.batchSize ? listed.at(-1)?.key : undefined,
        );
        const oldObjects = listed.filter(
          (object) =>
            object.lastModified &&
            object.lastModified.getTime() < now - this.orphanGraceMs,
        );
        if (oldObjects.length > 0) {
          const keys = oldObjects.map((object) => object.key);
          const [knownAssets, knownVariants] = await Promise.all([
            this.prisma.asset.findMany({
              where: {
                OR: [
                  { objectKey: { in: keys } },
                  { sourceObjectKey: { in: keys } },
                ],
              },
              select: { objectKey: true, sourceObjectKey: true },
            }),
            this.prisma.assetVariant.findMany({
              where: { objectKey: { in: keys } },
              select: { objectKey: true },
            }),
          ]);
          const knownKeys = new Set([
            ...knownAssets.flatMap((asset) => [
              asset.objectKey,
              ...(asset.sourceObjectKey ? [asset.sourceObjectKey] : []),
            ]),
            ...knownVariants.map((variant) => variant.objectKey),
          ]);
          for (const object of oldObjects) {
            if (!knownKeys.has(object.key)) {
              await this.storage.deleteObject(object.key);
              deletedOrphans += 1;
            }
          }
        }
      }

      const result = { deletedRecords, deletedOrphans };
      this.observability.recordCleanup(result);
      return result;
    } catch (error) {
      this.observability.recordCleanup({
        deletedRecords,
        deletedOrphans,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async deleteRecordAndReleaseQuota(assetId: string): Promise<number> {
    return this.prisma.$transaction(
      async (transaction) => {
        const asset = await transaction.asset.findUnique({
          where: { id: assetId },
        });
        if (!asset) {
          return 0;
        }
        await transaction.asset.delete({ where: { id: asset.id } });
        if (asset.storageBytes > 0) {
          await transaction.workspace.update({
            where: { id: asset.workspaceId },
            data: { storageUsedBytes: { decrement: asset.storageBytes } },
          });
        }
        return 1;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

function seconds(value: string | undefined, fallbackSeconds: number): number {
  return positiveInteger(value, fallbackSeconds) * 1_000;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
