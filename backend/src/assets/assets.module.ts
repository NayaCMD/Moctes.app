import { Module } from '@nestjs/common';
import { ObjectStorageModule } from '../object-storage/object-storage.module';
import { AssetMaintenanceService } from './asset-maintenance.service';
import { AssetProcessingModule } from './asset-processing.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [ObjectStorageModule, AssetProcessingModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetMaintenanceService],
  exports: [AssetMaintenanceService, AssetProcessingModule],
})
export class AssetsModule {}
