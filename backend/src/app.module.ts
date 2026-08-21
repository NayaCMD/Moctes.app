import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AssetsModule } from './assets/assets.module';
import { SessionAuthGuard } from './auth/session-auth.guard';
import { AuthorizationModule } from './authorization/authorization.module';
import { PolicyGuard } from './authorization/policy.guard';
import { DocumentsModule } from './documents/documents.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { SharingModule } from './sharing/sharing.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ObjectStorageModule } from './object-storage/object-storage.module';
import { validateEnvironment } from './config/environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    AssetsModule,
    ObjectStorageModule,
    AuthorizationModule,
    WorkspacesModule,
    DocumentsModule,
    SharingModule,
    CollaborationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
  ],
})
export class AppModule {}
