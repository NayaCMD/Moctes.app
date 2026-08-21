import { SetMetadata } from '@nestjs/common';
import type { WorkspacePermission } from './permissions';

export type PolicyResource = 'workspace' | 'document' | 'asset';

export interface RequiredPermission {
  permission: WorkspacePermission;
  resource: PolicyResource;
}

export const REQUIRED_PERMISSION = 'requiredWorkspacePermission';

export const RequirePermission = (
  requirement: RequiredPermission,
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION, requirement);
