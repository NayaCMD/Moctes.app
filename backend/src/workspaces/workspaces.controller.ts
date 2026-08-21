import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { AddMembershipDto } from './dto/add-membership.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.workspaces.listForUser(principal.user.id);
  }

  @Post()
  create(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(principal.user.id, dto);
  }

  @Patch(':workspaceId')
  @RequirePermission({ permission: 'workspace:update', resource: 'workspace' })
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(principal.user.id, workspaceId, dto);
  }

  @Get(':workspaceId/members')
  @RequirePermission({ permission: 'members:read', resource: 'workspace' })
  listMembers(
    @CurrentUser() principal: AuthPrincipal,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaces.listMembers(principal.user.id, workspaceId);
  }

  @Post(':workspaceId/members')
  @RequirePermission({ permission: 'members:manage', resource: 'workspace' })
  addMember(
    @CurrentUser() principal: AuthPrincipal,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AddMembershipDto,
  ) {
    return this.workspaces.addMember(principal.user.id, workspaceId, dto);
  }

  @Patch(':workspaceId/members/:membershipId')
  @RequirePermission({ permission: 'members:manage', resource: 'workspace' })
  updateMember(
    @CurrentUser() principal: AuthPrincipal,
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.workspaces.updateMember(
      principal.user.id,
      workspaceId,
      membershipId,
      dto,
    );
  }

  @Delete(':workspaceId/members/:membershipId')
  @RequirePermission({ permission: 'members:manage', resource: 'workspace' })
  @HttpCode(204)
  removeMember(
    @CurrentUser() principal: AuthPrincipal,
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.workspaces.removeMember(
      principal.user.id,
      workspaceId,
      membershipId,
    );
  }

  @Get(':workspaceId/invitations')
  @RequirePermission({ permission: 'members:manage', resource: 'workspace' })
  listInvitations(
    @CurrentUser() principal: AuthPrincipal,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaces.listInvitations(principal.user.id, workspaceId);
  }

  @Post(':workspaceId/invitations')
  @RequirePermission({ permission: 'members:manage', resource: 'workspace' })
  createInvitation(
    @CurrentUser() principal: AuthPrincipal,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.workspaces.createInvitation(
      principal.user.id,
      workspaceId,
      dto,
    );
  }

  @Delete(':workspaceId/invitations/:invitationId')
  @RequirePermission({ permission: 'members:manage', resource: 'workspace' })
  @HttpCode(204)
  revokeInvitation(
    @CurrentUser() principal: AuthPrincipal,
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.workspaces.revokeInvitation(
      principal.user.id,
      workspaceId,
      invitationId,
    );
  }

  @Post('invitations/:token/accept')
  acceptInvitation(
    @CurrentUser() principal: AuthPrincipal,
    @Param('token') token: string,
  ) {
    return this.workspaces.acceptInvitation(principal.user.id, token);
  }
}
