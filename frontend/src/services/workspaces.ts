import type { AuthWorkspace, WorkspaceRole } from "../stores/useAuthStore";
import { apiDelete, apiGet, apiPatch, apiPost } from "./apiClient";

export interface WorkspaceMembership {
  id: string;
  role: WorkspaceRole;
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  user: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export function createWorkspace(name: string) {
  return apiPost<{ name: string }, AuthWorkspace>("/workspaces", { name });
}

export function updateWorkspace(workspaceId: string, name: string) {
  return apiPatch<{ name: string }, AuthWorkspace>(
    `/workspaces/${encodeURIComponent(workspaceId)}`,
    { name },
  );
}

export function listWorkspaceMembers(workspaceId: string) {
  return apiGet<WorkspaceMembership[]>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members`,
  );
}

export function updateWorkspaceMember(
  workspaceId: string,
  membershipId: string,
  role: WorkspaceRole,
) {
  return apiPatch<{ role: WorkspaceRole }, WorkspaceMembership>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(membershipId)}`,
    { role },
  );
}

export function removeWorkspaceMember(
  workspaceId: string,
  membershipId: string,
) {
  return apiDelete<null>(
    `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(membershipId)}`,
  );
}
