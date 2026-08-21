import { Injectable } from '@nestjs/common';
import {
  AssetProcessingJobStatus,
  Prisma,
  type AssetProcessingJob,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetProcessingQueueService {
  private readonly lockTimeoutMs: number;
  private readonly maxAttempts: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.lockTimeoutMs =
      positiveInteger(
        config.get<string>('ASSET_PROCESSING_LOCK_TIMEOUT_SECONDS'),
        120,
      ) * 1_000;
    this.maxAttempts = positiveInteger(
      config.get<string>('ASSET_PROCESSING_MAX_ATTEMPTS'),
      5,
    );
  }

  enqueue(
    transaction: Prisma.TransactionClient,
    assetId: string,
  ): Promise<AssetProcessingJob> {
    return transaction.assetProcessingJob.upsert({
      where: { assetId },
      create: {
        assetId,
        maxAttempts: this.maxAttempts,
      },
      update: {
        status: AssetProcessingJobStatus.QUEUED,
        attempts: 0,
        maxAttempts: this.maxAttempts,
        availableAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  async claim(workerId: string): Promise<AssetProcessingJob | null> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const staleBefore = new Date(Date.now() - this.lockTimeoutMs);
      const candidate = await this.prisma.assetProcessingJob.findFirst({
        where: {
          OR: [
            {
              status: AssetProcessingJobStatus.QUEUED,
              availableAt: { lte: new Date() },
            },
            {
              status: AssetProcessingJobStatus.RUNNING,
              lockedAt: { lt: staleBefore },
            },
          ],
        },
        orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
      });
      if (!candidate) {
        return null;
      }

      const claimedAt = new Date();
      const claimed = await this.prisma.assetProcessingJob.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          lockedAt: candidate.lockedAt,
        },
        data: {
          status: AssetProcessingJobStatus.RUNNING,
          attempts: { increment: 1 },
          lockedAt: claimedAt,
          lockedBy: workerId,
        },
      });
      if (claimed.count > 0) {
        return this.prisma.assetProcessingJob.findUniqueOrThrow({
          where: { id: candidate.id },
        });
      }
    }
    return null;
  }

  async heartbeat(jobId: string, workerId: string): Promise<boolean> {
    const result = await this.prisma.assetProcessingJob.updateMany({
      where: {
        id: jobId,
        status: AssetProcessingJobStatus.RUNNING,
        lockedBy: workerId,
      },
      data: { lockedAt: new Date() },
    });
    return result.count > 0;
  }

  async complete(jobId: string, workerId: string): Promise<void> {
    await this.prisma.assetProcessingJob.updateMany({
      where: {
        id: jobId,
        status: AssetProcessingJobStatus.RUNNING,
        lockedBy: workerId,
      },
      data: {
        status: AssetProcessingJobStatus.COMPLETED,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  async retry(
    job: Pick<AssetProcessingJob, 'id' | 'attempts'>,
    workerId: string,
    error: string,
  ): Promise<void> {
    const delaySeconds = Math.min(60, 2 ** Math.max(0, job.attempts - 1));
    await this.prisma.assetProcessingJob.updateMany({
      where: {
        id: job.id,
        status: AssetProcessingJobStatus.RUNNING,
        lockedBy: workerId,
      },
      data: {
        status: AssetProcessingJobStatus.QUEUED,
        availableAt: new Date(Date.now() + delaySeconds * 1_000),
        lockedAt: null,
        lockedBy: null,
        lastError: error.slice(0, 2_000),
      },
    });
  }

  async fail(jobId: string, workerId: string, error: string): Promise<void> {
    await this.prisma.assetProcessingJob.updateMany({
      where: {
        id: jobId,
        status: AssetProcessingJobStatus.RUNNING,
        lockedBy: workerId,
      },
      data: {
        status: AssetProcessingJobStatus.FAILED,
        lockedAt: null,
        lockedBy: null,
        lastError: error.slice(0, 2_000),
      },
    });
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
