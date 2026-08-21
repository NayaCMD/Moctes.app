import { Module } from '@nestjs/common';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';
import { ObjectStorageModule } from '../object-storage/object-storage.module';

@Module({
  imports: [ObjectStorageModule],
  controllers: [SharingController],
  providers: [SharingService],
})
export class SharingModule {}
