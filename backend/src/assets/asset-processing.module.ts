import { Module } from '@nestjs/common';
import { ObjectStorageModule } from '../object-storage/object-storage.module';
import { AssetObservabilityService } from './asset-observability.service';
import { AssetProcessingQueueService } from './asset-processing-queue.service';
import { AssetProcessorService } from './asset-processor.service';
import { ClamAvService } from './clamav.service';
import { SvgSanitizerService } from './svg-sanitizer.service';

@Module({
  imports: [ObjectStorageModule],
  providers: [
    AssetProcessingQueueService,
    AssetProcessorService,
    AssetObservabilityService,
    ClamAvService,
    SvgSanitizerService,
  ],
  exports: [
    AssetProcessingQueueService,
    AssetProcessorService,
    AssetObservabilityService,
    ClamAvService,
  ],
})
export class AssetProcessingModule {}
