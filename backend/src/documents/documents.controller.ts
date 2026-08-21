import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { RestoreDocumentRevisionDto } from './dto/restore-document-revision.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import {
  DocumentsService,
  type PersistedDocumentResponse,
} from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequirePermission({ permission: 'document:read', resource: 'workspace' })
  findAll(
    @CurrentUser() principal: AuthPrincipal,
    @Query('workspaceId') workspaceId: string,
  ): Promise<PersistedDocumentResponse[]> {
    return this.documentsService.findAll(principal.user.id, workspaceId);
  }

  @Get('trash')
  @RequirePermission({ permission: 'document:read', resource: 'workspace' })
  findDeleted(
    @CurrentUser() principal: AuthPrincipal,
    @Query('workspaceId') workspaceId: string,
  ): Promise<PersistedDocumentResponse[]> {
    return this.documentsService.findDeleted(principal.user.id, workspaceId);
  }

  @Get(':id')
  @RequirePermission({ permission: 'document:read', resource: 'document' })
  findOne(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<PersistedDocumentResponse> {
    return this.documentsService.findOne(principal.user.id, id);
  }

  @Get(':id/revisions')
  @RequirePermission({ permission: 'document:read', resource: 'document' })
  listRevisions(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
  ) {
    return this.documentsService.listRevisions(principal.user.id, id);
  }

  @Get(':id/revisions/:version')
  @RequirePermission({ permission: 'document:read', resource: 'document' })
  findRevision(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.documentsService.findRevision(principal.user.id, id, version);
  }

  @Post(':id/revisions/:version/restore')
  @RequirePermission({ permission: 'document:update', resource: 'document' })
  restoreRevision(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: RestoreDocumentRevisionDto,
  ): Promise<PersistedDocumentResponse> {
    return this.documentsService.restoreRevision(
      principal.user.id,
      id,
      version,
      dto.expectedVersion,
      dto.expectedCollaborationSequence,
    );
  }

  @Post()
  @RequirePermission({ permission: 'document:create', resource: 'workspace' })
  create(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: CreateDocumentDto,
  ): Promise<PersistedDocumentResponse> {
    return this.documentsService.create(principal.user.id, dto);
  }

  @Put(':id')
  @RequirePermission({ permission: 'document:update', resource: 'document' })
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<PersistedDocumentResponse> {
    return this.documentsService.update(principal.user.id, id, dto);
  }

  @Delete(':id')
  @RequirePermission({ permission: 'document:delete', resource: 'document' })
  @HttpCode(204)
  remove(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.documentsService.remove(principal.user.id, id);
  }

  @Post(':id/restore-deleted')
  @RequirePermission({ permission: 'document:update', resource: 'workspace' })
  restoreDeleted(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ): Promise<PersistedDocumentResponse> {
    return this.documentsService.restoreDeleted(
      principal.user.id,
      id,
      workspaceId,
    );
  }
}
