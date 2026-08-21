import { Module } from '@nestjs/common';
import { CollaborationBroadcaster } from './collaboration-broadcaster.service';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationService } from './collaboration.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    CollaborationBroadcaster,
    CollaborationGateway,
    CollaborationService,
  ],
  exports: [CollaborationBroadcaster, CollaborationService],
})
export class CollaborationModule {}
