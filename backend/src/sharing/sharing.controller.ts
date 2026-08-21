import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { SharingService } from './sharing.service';

@Controller()
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @Get('documents/:id/share-links')
  @RequirePermission({ permission: 'document:share', resource: 'document' })
  list(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') documentId: string,
  ) {
    return this.sharing.list(principal.user.id, documentId);
  }

  @Post('documents/:id/share-links')
  @RequirePermission({ permission: 'document:share', resource: 'document' })
  create(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') documentId: string,
    @Body() dto: CreateShareLinkDto,
  ) {
    return this.sharing.create(principal.user.id, documentId, dto);
  }

  @Delete('documents/:id/share-links/:linkId')
  @RequirePermission({ permission: 'document:share', resource: 'document' })
  @HttpCode(204)
  revoke(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') documentId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.sharing.revoke(principal.user.id, documentId, linkId);
  }

  @Public()
  @Get('shares/:token')
  resolve(@Param('token') token: string) {
    return this.sharing.resolvePublicLink(token);
  }
}
