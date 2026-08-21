import { Injectable, Logger } from '@nestjs/common';

export type AssetOperationalEvent =
  | 'upload_ticket_created'
  | 'upload_completed'
  | 'upload_rejected'
  | 'quota_rejected'
  | 'asset_deleted';

interface AssetCounters {
  uploadTicketsCreated: number;
  uploadsCompleted: number;
  uploadsRejected: number;
  quotaRejections: number;
  assetsDeleted: number;
}

export interface AssetObservabilitySnapshot extends AssetCounters {
  lastCleanupAt: string | null;
  lastCleanupDeleted: number;
  lastCleanupOrphans: number;
  lastCleanupStatus: 'ok' | 'error' | null;
}

const emptyCounters = (): AssetCounters => ({
  uploadTicketsCreated: 0,
  uploadsCompleted: 0,
  uploadsRejected: 0,
  quotaRejections: 0,
  assetsDeleted: 0,
});

@Injectable()
export class AssetObservabilityService {
  private readonly logger = new Logger('AssetLifecycle');
  private readonly counters = new Map<string, AssetCounters>();
  private lastCleanupAt: string | null = null;
  private lastCleanupDeleted = 0;
  private lastCleanupOrphans = 0;
  private lastCleanupError: string | null = null;

  record(
    workspaceId: string,
    event: AssetOperationalEvent,
    details: Record<string, unknown> = {},
  ): void {
    const counters = this.counters.get(workspaceId) ?? emptyCounters();
    switch (event) {
      case 'upload_ticket_created':
        counters.uploadTicketsCreated += 1;
        break;
      case 'upload_completed':
        counters.uploadsCompleted += 1;
        break;
      case 'upload_rejected':
        counters.uploadsRejected += 1;
        break;
      case 'quota_rejected':
        counters.quotaRejections += 1;
        break;
      case 'asset_deleted':
        counters.assetsDeleted += 1;
        break;
    }
    this.counters.set(workspaceId, counters);
    this.logger.log(
      JSON.stringify({
        event: `asset.${event}`,
        workspaceId,
        ...details,
      }),
    );
  }

  recordCleanup(result: {
    deletedRecords: number;
    deletedOrphans: number;
    error?: string;
  }): void {
    this.lastCleanupAt = new Date().toISOString();
    this.lastCleanupDeleted = result.deletedRecords;
    this.lastCleanupOrphans = result.deletedOrphans;
    this.lastCleanupError = result.error ?? null;
    const payload = {
      event: 'asset.cleanup_completed',
      ...result,
      at: this.lastCleanupAt,
    };
    if (result.error) {
      this.logger.error(JSON.stringify(payload));
    } else {
      this.logger.log(JSON.stringify(payload));
    }
  }

  recordProcessing(
    assetId: string,
    outcome: 'ready' | 'retry' | 'quarantined' | 'rejected',
    details: Record<string, unknown> = {},
  ): void {
    this.logger.log(
      JSON.stringify({
        event: `asset.processing_${outcome}`,
        assetId,
        ...details,
      }),
    );
  }

  snapshot(workspaceId: string): AssetObservabilitySnapshot {
    return {
      ...(this.counters.get(workspaceId) ?? emptyCounters()),
      lastCleanupAt: this.lastCleanupAt,
      lastCleanupDeleted: this.lastCleanupDeleted,
      lastCleanupOrphans: this.lastCleanupOrphans,
      lastCleanupStatus: this.lastCleanupAt
        ? this.lastCleanupError
          ? 'error'
          : 'ok'
        : null,
    };
  }
}
