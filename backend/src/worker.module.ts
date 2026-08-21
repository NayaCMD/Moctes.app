import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetProcessingModule } from './assets/asset-processing.module';
import { AssetProcessingWorkerService } from './assets/asset-processing-worker.service';
import { PrismaModule } from './prisma/prisma.module';
import { validateEnvironment } from './config/environment';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    PrismaModule,
    AssetProcessingModule,
  ],
  providers: [AssetProcessingWorkerService],
})
export class WorkerModule {}
