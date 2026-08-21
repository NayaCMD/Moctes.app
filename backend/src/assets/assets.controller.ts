import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { AssetsService } from './assets.service';
import { CreateAssetUploadDto } from './dto/create-asset-upload.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('usage')
  @RequirePermission({ permission: 'asset:read', resource: 'workspace' })
  usage(
    @CurrentUser() principal: AuthPrincipal,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.assets.usage(principal.user.id, workspaceId);
  }

  @Get()
  @RequirePermission({ permission: 'asset:read', resource: 'workspace' })
  list(
    @CurrentUser() principal: AuthPrincipal,
    @Query('workspaceId') workspaceId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assets.list(principal.user.id, workspaceId, cursor, limit);
  }

  @Get(':id')
  @RequirePermission({ permission: 'asset:read', resource: 'asset' })
  get(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.assets.get(principal.user.id, id);
  }

  @Post('uploads')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermission({ permission: 'asset:create', resource: 'workspace' })
  createUpload(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: CreateAssetUploadDto,
  ) {
    return this.assets.createUpload(principal.user.id, dto);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermission({ permission: 'asset:create', resource: 'asset' })
  complete(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.assets.complete(principal.user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission({ permission: 'asset:delete', resource: 'asset' })
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.assets.remove(principal.user.id, id);
  }
}
