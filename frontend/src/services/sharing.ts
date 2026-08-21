import type { MoctesDocument } from "../types/document.types";
import type { WorkspaceRole } from "../stores/useAuthStore";
import { apiDelete, apiGet, apiPost, type ApiResponse } from "./apiClient";

export interface ShareLink {
  id: string;
  documentId: string;
  access: "READ_ONLY";
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  token?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  invitedBy: { id: string; name: string };
  token?: string;
}

export interface PublicDocumentShare {
  access: "READ_ONLY";
  documentId: string;
  document: MoctesDocument;
  updatedAt: string;
}

export function listShareLinks(documentId: string) {
  return apiGet<ShareLink[]>(
    `/documents/${encodeURIComponent(documentId)}/share-links`,
  );
}

export function createShareLink(documentId: string, expiresInDays?: number) {
  return apiPost<{ expiresInDays?: number }, ShareLink>(
    `/documents/${encodeURIComponent(documentId)}/share-links`,
    expiresInDays ? { expiresInDays } : {},
  );
}

export function revokeShareLink(documentId: string, linkId: string) {
  return apiDelete<null>(
    `/documents/${encodeURIComponent(documentId)}/share-links/${encodeURIComponent(linkId)}`,
  );
}

export function loadPublicShare(token: string): Promise<ApiResponse<PublicDocumentShare>> {
  return apiGet<PublicDocumentShare>(`/shares/${encodeURIComponent(token)}`);
}

export function listWorkspaceInvitations(workspaceId: string) {
  return apiGet<WorkspaceInvitation[]>(
    `/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
  );
}

export function createWorkspaceInvitation(options: {
  workspaceId: string;
  email: string;
  role: Exclude<WorkspaceRole, "OWNER">;
  expiresInDays?: number;
}) {
  return apiPost<
    { email: string; role: Exclude<WorkspaceRole, "OWNER">; expiresInDays?: number },
    WorkspaceInvitation
  >(`/workspaces/${encodeURIComponent(options.workspaceId)}/invitations`, {
    email: options.email,
    role: options.role,
    expiresInDays: options.expiresInDays,
  });
}

export function revokeWorkspaceInvitation(
  workspaceId: string,
  invitationId: string,
) {
  return apiDelete<null>(
    `/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}`,
  );
}

export function acceptWorkspaceInvitation(token: string) {
  return apiPost<undefined, { id: string; name: string; slug: string; role: WorkspaceRole }>(
    `/workspaces/invitations/${encodeURIComponent(token)}/accept`,
  );
}

export function buildPublicShareUrl(token: string): string {
  return `${window.location.origin}/share/${encodeURIComponent(token)}`;
}

export function buildInvitationUrl(token: string): string {
  return `${window.location.origin}/invite/${encodeURIComponent(token)}`;
}
