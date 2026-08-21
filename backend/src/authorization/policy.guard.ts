import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PoliciesService } from './policies.service';
import {
  REQUIRED_PERMISSION,
  type RequiredPermission,
} from './require-permission.decorator';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policies: PoliciesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const requirement = this.reflector.getAllAndOverride<RequiredPermission>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new UnauthorizedException('Authentication is required.');
    }

    if (requirement.resource === 'document') {
      const documentId = readString(request.params?.id);
      if (!documentId) {
        throw new BadRequestException('A document id is required.');
      }
      await this.policies.assertDocumentPermission(
        request.auth.user.id,
        documentId,
        requirement.permission,
      );
      return true;
    }

    if (requirement.resource === 'asset') {
      const assetId = readString(request.params?.id);
      if (!assetId) {
        throw new BadRequestException('An asset id is required.');
      }
      await this.policies.assertAssetPermission(
        request.auth.user.id,
        assetId,
        requirement.permission,
      );
      return true;
    }

    const workspaceId =
      readString(request.params?.workspaceId) ??
      readString(readProperty(request.body as unknown, 'workspaceId')) ??
      readString(request.query?.workspaceId);
    if (!workspaceId) {
      throw new BadRequestException('A workspace id is required.');
    }
    await this.policies.assertWorkspacePermission(
      request.auth.user.id,
      workspaceId,
      requirement.permission,
    );
    return true;
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readProperty(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}
