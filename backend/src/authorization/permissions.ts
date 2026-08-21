import { WorkspaceRole } from '@prisma/client';

export const workspacePermissions = [
  'workspace:read',
  'workspace:update',
  'workspace:delete',
  'members:read',
  'members:manage',
  'document:read',
  'document:create',
  'document:update',
  'document:delete',
  'document:share',
  'asset:read',
  'asset:create',
  'asset:delete',
] as const;

export type WorkspacePermission = (typeof workspacePermissions)[number];

const rolePermissions: Record<
  WorkspaceRole,
  ReadonlySet<WorkspacePermission>
> = {
  [WorkspaceRole.OWNER]: new Set(workspacePermissions),
  [WorkspaceRole.ADMIN]: new Set([
    'workspace:read',
    'workspace:update',
    'members:read',
    'members:manage',
    'document:read',
    'document:create',
    'document:update',
    'document:delete',
    'document:share',
    'asset:read',
    'asset:create',
    'asset:delete',
  ]),
  [WorkspaceRole.EDITOR]: new Set([
    'workspace:read',
    'members:read',
    'document:read',
    'document:create',
    'document:update',
    'document:delete',
    'asset:read',
    'asset:create',
    'asset:delete',
  ]),
  [WorkspaceRole.VIEWER]: new Set([
    'workspace:read',
    'members:read',
    'document:read',
    'asset:read',
  ]),
};

export function roleHasPermission(
  role: WorkspaceRole,
  permission: WorkspacePermission,
): boolean {
  return rolePermissions[role].has(permission);
}
