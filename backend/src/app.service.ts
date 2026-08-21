import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { ObjectStorageService } from './object-storage/object-storage.service';
import { ClamAvService } from './assets/clamav.service';

export interface HealthResponse {
  status: string;
  application: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly antivirus: ClamAvService,
  ) {}

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      application: 'MOCTES API',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<{
    status: 'ready' | 'degraded';
    application: string;
    timestamp: string;
    dependencies: Record<string, 'ok' | 'error'>;
  }> {
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.storage.checkHealth(),
      this.antivirus.checkHealth(),
    ]);
    const dependencies = {
      postgres: checks[0].status === 'fulfilled' ? 'ok' : 'error',
      objectStorage: checks[1].status === 'fulfilled' ? 'ok' : 'error',
      antivirus: checks[2].status === 'fulfilled' ? 'ok' : 'error',
    } as const;
    return {
      status: Object.values(dependencies).every((value) => value === 'ok')
        ? 'ready'
        : 'degraded',
      application: 'MOCTES API',
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }
}
