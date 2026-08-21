import type { Request } from 'express';
import type { WorkspaceRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthenticatedWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface AuthPrincipal {
  sessionId: string;
  user: AuthenticatedUser;
  workspaces: AuthenticatedWorkspace[];
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthPrincipal;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedSession {
  token: string;
  principal: AuthPrincipal;
}
