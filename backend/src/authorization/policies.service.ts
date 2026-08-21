import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, type WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { roleHasPermission, type WorkspacePermission } from './permissions';

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async assertWorkspacePermission(
    userId: string,
    workspaceId: string,
    permission: WorkspacePermission,
  ): Promise<{ role: WorkspaceRole }> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true, status: true },
    });
    if (
      !membership ||
      membership.status !== MembershipStatus.ACTIVE ||
      !roleHasPermission(membership.role, permission)
    ) {
      throw new ForbiddenException(
        `You do not have permission to perform ${permission} in this workspace.`,
      );
    }
    return { role: membership.role };
  }

  async assertDocumentPermission(
    userId: string,
    documentId: string,
    permission: WorkspacePermission,
  ): Promise<{ workspaceId: string; role: WorkspaceRole }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { workspaceId: true, deletedAt: true },
    });
    if (!document || document.deletedAt) {
      throw new NotFoundException(`Document ${documentId} was not found.`);
    }
    const membership = await this.assertWorkspacePermission(
      userId,
      document.workspaceId,
      permission,
    );
    return { workspaceId: document.workspaceId, role: membership.role };
  }

  async assertAssetPermission(
    userId: string,
    assetId: string,
    permission: WorkspacePermission,
  ): Promise<{ workspaceId: string; role: WorkspaceRole }> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { workspaceId: true },
    });
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} was not found.`);
    }
    const membership = await this.assertWorkspacePermission(
      userId,
      asset.workspaceId,
      permission,
    );
    return { workspaceId: asset.workspaceId, role: membership.role };
  }
}
