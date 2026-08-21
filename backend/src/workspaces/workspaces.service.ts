import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import {
  MembershipStatus,
  Prisma,
  WorkspaceInvitationStatus,
  WorkspaceRole,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PoliciesService } from '../authorization/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddMembershipDto } from './dto/add-membership.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { CollaborationBroadcaster } from '../collaboration/collaboration-broadcaster.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly collaboration: CollaborationBroadcaster,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(({ workspace, role }) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    }));
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    const workspace = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.workspace.create({
        data: {
          name: dto.name.trim(),
          slug: workspaceSlug(dto.name),
          createdById: userId,
        },
      });
      await transaction.membership.create({
        data: {
          userId,
          workspaceId: created.id,
          role: WorkspaceRole.OWNER,
        },
      });
      return created;
    });
    return { ...workspace, role: WorkspaceRole.OWNER };
  }

  async update(userId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    const membership = await this.policies.assertWorkspacePermission(
      userId,
      workspaceId,
      'workspace:update',
    );
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name.trim() },
    });
    return { ...workspace, role: membership.role };
  }

  async listMembers(actorId: string, workspaceId: string) {
    await this.policies.assertWorkspacePermission(
      actorId,
      workspaceId,
      'members:read',
    );
    const memberships = await this.prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(toMembershipResponse);
  }

  async addMember(actorId: string, workspaceId: string, dto: AddMembershipDto) {
    const actor = await this.policies.assertWorkspacePermission(
      actorId,
      workspaceId,
      'members:manage',
    );
    assertCanAssignRole(actor.role, dto.role);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(
        'The user must create an account before being added.',
      );
    }

    try {
      const membership = await this.prisma.membership.create({
        data: {
          userId: user.id,
          workspaceId,
          role: dto.role,
          status: MembershipStatus.ACTIVE,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return toMembershipResponse(membership);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('The user is already a workspace member.');
      }
      throw error;
    }
  }

  async updateMember(
    actorId: string,
    workspaceId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    if (dto.role === undefined && dto.status === undefined) {
      throw new BadRequestException(
        'At least one membership field is required.',
      );
    }
    const actor = await this.policies.assertWorkspacePermission(
      actorId,
      workspaceId,
      'members:manage',
    );
    const target = await this.getMembership(workspaceId, membershipId);
    assertCanManageTarget(actor.role, target.role);
    if (dto.role) {
      assertCanAssignRole(actor.role, dto.role);
    }
    const updated = await retrySerializableTransaction(() =>
      this.prisma.$transaction(
        async (transaction) => {
          if (
            target.role === WorkspaceRole.OWNER &&
            ((dto.role !== undefined && dto.role !== WorkspaceRole.OWNER) ||
              (dto.status !== undefined &&
                dto.status !== MembershipStatus.ACTIVE))
          ) {
            await this.assertAnotherOwnerExists(
              transaction,
              workspaceId,
              target.id,
            );
          }
          return transaction.membership.update({
            where: { id: membershipId },
            data: { role: dto.role, status: dto.status },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    await this.collaboration.revokeWorkspaceAccess(workspaceId, target.userId);
    return toMembershipResponse(updated);
  }

  async removeMember(
    actorId: string,
    workspaceId: string,
    membershipId: string,
  ): Promise<void> {
    const actor = await this.policies.assertWorkspacePermission(
      actorId,
      workspaceId,
      'members:manage',
    );
    const target = await this.getMembership(workspaceId, membershipId);
    assertCanManageTarget(actor.role, target.role);
    await retrySerializableTransaction(() =>
      this.prisma.$transaction(
        async (transaction) => {
          if (target.role === WorkspaceRole.OWNER) {
            await this.assertAnotherOwnerExists(
              transaction,
              workspaceId,
              target.id,
            );
          }
          await transaction.membership.delete({ where: { id: target.id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    await this.collaboration.revokeWorkspaceAccess(workspaceId, target.userId);
  }

  async listInvitations(actorId: string, workspaceId: string) {
    await this.policies.assertWorkspacePermission(
      actorId,
      workspaceId,
      'members:manage',
    );
    await this.expireInvitations(workspaceId);
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: { invitedBy: { select: { id: true, name: true } } },
    });
    return invitations.map(toInvitationResponse);
  }

  async createInvitation(
    actorId: string,
    workspaceId: string,
    dto: CreateInvitationDto,
  ) {
    const actor = await this.policies.assertWorkspacePermission(
      actorId,
      workspaceId,
      'members:manage',
    );
    assertCanAssignRole(actor.role, dto.role);
    if (dto.role === WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'Ownership must be assigned to an active member.',
      );
    }
    const email = dto.email.trim().toLowerCase();
    const existingMember = await this.prisma.membership.findFirst({
      where: { workspaceId, user: { email } },
      select: { id: true },
    });
    if (existingMember) {
      throw new ConflictException('The user is already a workspace member.');
    }
    await this.prisma.workspaceInvitation.updateMany({
      where: {
        workspaceId,
        email,
        status: WorkspaceInvitationStatus.PENDING,
      },
      data: {
        status: WorkspaceInvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role: dto.role,
        tokenHash: hashToken(token),
        invitedById: actorId,
        expiresAt: new Date(Date.now() + (dto.expiresInDays ?? 7) * 86_400_000),
      },
      include: { invitedBy: { select: { id: true, name: true } } },
    });
    return { ...toInvitationResponse(invitation), token };
  }

  async revokeInvitation(
    actorId: string,
    workspaceId: string,
    invitationId: string,
  ): Promise<void> {
    await this.policies.assertWorkspacePermission(
      actorId,
      workspaceId,
      'members:manage',
    );
    const result = await this.prisma.workspaceInvitation.updateMany({
      where: {
        id: invitationId,
        workspaceId,
        status: WorkspaceInvitationStatus.PENDING,
      },
      data: {
        status: WorkspaceInvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('Pending invitation was not found.');
    }
  }

  async acceptInvitation(userId: string, token: string) {
    if (token.length < 32 || token.length > 128) {
      throw new NotFoundException('Invitation was not found.');
    }
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
    });
    if (
      invitation?.status === WorkspaceInvitationStatus.ACCEPTED &&
      invitation.acceptedById === userId
    ) {
      const membership = await this.prisma.membership.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: invitation.workspaceId },
        },
        select: { role: true, status: true },
      });
      if (membership?.status === MembershipStatus.ACTIVE) {
        return { ...invitation.workspace, role: membership.role };
      }
    }
    if (
      !invitation ||
      invitation.status !== WorkspaceInvitationStatus.PENDING
    ) {
      throw new NotFoundException(
        'Invitation was not found or is no longer active.',
      );
    }
    if (invitation.expiresAt <= new Date()) {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: WorkspaceInvitationStatus.EXPIRED },
      });
      throw new GoneException('Invitation has expired.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user || user.email.toLowerCase() !== invitation.email) {
      throw new ForbiddenException(
        'Sign in with the email address that received this invitation.',
      );
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.membership.upsert({
        where: {
          userId_workspaceId: { userId, workspaceId: invitation.workspaceId },
        },
        create: {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        },
      });
      await transaction.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: WorkspaceInvitationStatus.ACCEPTED,
          acceptedById: userId,
          acceptedAt: new Date(),
        },
      });
    });
    return { ...invitation.workspace, role: invitation.role };
  }

  private async expireInvitations(workspaceId: string): Promise<void> {
    await this.prisma.workspaceInvitation.updateMany({
      where: {
        workspaceId,
        status: WorkspaceInvitationStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: WorkspaceInvitationStatus.EXPIRED },
    });
  }

  private async getMembership(workspaceId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, workspaceId },
      select: { id: true, role: true, userId: true },
    });
    if (!membership) {
      throw new NotFoundException(
        'Membership was not found in this workspace.',
      );
    }
    return membership;
  }

  private async assertAnotherOwnerExists(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    excludedMembershipId: string,
  ): Promise<void> {
    const ownerCount = await transaction.membership.count({
      where: {
        workspaceId,
        id: { not: excludedMembershipId },
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (ownerCount === 0) {
      throw new ConflictException('A workspace must keep at least one owner.');
    }
  }
}

async function retrySerializableTransaction<T>(
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034' ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }
  throw new Error('Serializable transaction retry budget exhausted.');
}

function toInvitationResponse(invitation: {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceInvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  invitedBy: { id: string; name: string };
}) {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
    invitedBy: invitation.invitedBy,
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toMembershipResponse(membership: {
  id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string; email: string };
}) {
  return {
    id: membership.id,
    role: membership.role,
    status: membership.status,
    user: membership.user,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  };
}

function assertCanAssignRole(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
): void {
  if (targetRole === WorkspaceRole.OWNER && actorRole !== WorkspaceRole.OWNER) {
    throw new ForbiddenException('Only an owner can assign the owner role.');
  }
}

function assertCanManageTarget(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
): void {
  if (targetRole === WorkspaceRole.OWNER && actorRole !== WorkspaceRole.OWNER) {
    throw new ForbiddenException('Only an owner can manage another owner.');
  }
}

function workspaceSlug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42);
  return `${base || 'workspace'}-${randomBytes(5).toString('hex')}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
