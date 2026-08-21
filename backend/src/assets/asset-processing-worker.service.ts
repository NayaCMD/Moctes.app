import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AssetObservabilityService } from './asset-observability.service';
import {
  AssetProcessingError,
  AssetProcessorService,
} from './asset-processor.service';
import { AssetProcessingQueueService } from './asset-processing-queue.service';

@Injectable()
export class AssetProcessingWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AssetProcessingWorkerService.name);
  private readonly workerId = `${process.pid}-${randomUUID()}`;
  private readonly pollIntervalMs: number;
  private running = false;
  private loop: Promise<void> | null = null;

  constructor(
    config: ConfigService,
    private readonly queue: AssetProcessingQueueService,
    private readonly processor: AssetProcessorService,
    private readonly observability: AssetObservabilityService,
  ) {
    this.pollIntervalMs = positiveInteger(
      config.get<string>('ASSET_PROCESSING_POLL_INTERVAL_MS'),
      1_000,
    );
  }

  onApplicationBootstrap(): void {
    this.running = true;
    this.logger.log(
      JSON.stringify({
        event: 'asset.worker_started',
        workerId: this.workerId,
      }),
    );
    this.loop = this.runLoop();
  }

  async onApplicationShutdown(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        const job = await this.queue.claim(this.workerId);
        if (!job) {
          await delay(this.pollIntervalMs);
          continue;
        }
        await this.handleJob(job);
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            event: 'asset.worker_loop_failed',
            workerId: this.workerId,
            error: errorMessage(error),
          }),
        );
        await delay(this.pollIntervalMs);
      }
    }
  }

  private async handleJob(job: {
    id: string;
    assetId: string;
    attempts: number;
    maxAttempts: number;
  }): Promise<void> {
    const heartbeat = setInterval(() => {
      void this.queue.heartbeat(job.id, this.workerId).catch((error) =>
        this.logger.error(
          JSON.stringify({
            event: 'asset.worker_heartbeat_failed',
            workerId: this.workerId,
            jobId: job.id,
            error: errorMessage(error),
          }),
        ),
      );
    }, 30_000);
    heartbeat.unref?.();
    try {
      const result = await this.processor.process(job.assetId);
      await this.queue.complete(job.id, this.workerId);
      if (result) {
        this.observability.recordProcessing(result.assetId, 'ready', {
          ...result,
        });
      }
    } catch (error) {
      if (error instanceof AssetProcessingError) {
        const status =
          error.disposition === 'rejected'
            ? AssetStatus.REJECTED
            : AssetStatus.QUARANTINED;
        await this.processor.markFailed(
          job.assetId,
          status,
          error.code,
          error.publicMessage,
        );
        await this.queue.fail(job.id, this.workerId, error.message);
        this.observability.recordProcessing(job.assetId, error.disposition, {
          code: error.code,
          error: error.message,
        });
        return;
      }

      const message = errorMessage(error);
      if (job.attempts < job.maxAttempts) {
        await this.queue.retry(job, this.workerId, message);
        this.observability.recordProcessing(job.assetId, 'retry', {
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          error: message,
        });
        return;
      }

      await this.processor.markFailed(
        job.assetId,
        AssetStatus.QUARANTINED,
        'PROCESSING_UNAVAILABLE',
        'Não foi possível confirmar a segurança da imagem. O arquivo foi isolado.',
      );
      await this.queue.fail(job.id, this.workerId, message);
      this.observability.recordProcessing(job.assetId, 'quarantined', {
        code: 'PROCESSING_UNAVAILABLE',
        error: message,
      });
    } finally {
      clearInterval(heartbeat);
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
