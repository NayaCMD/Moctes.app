import { useAuthStore, type WorkspaceRole } from "../stores/useAuthStore";

export interface WorkspaceCapabilities {
  role: WorkspaceRole | null;
  canEdit: boolean;
  canShare: boolean;
  canManageMembers: boolean;
  canDeleteWorkspace: boolean;
}

export function capabilitiesForRole(
  role: WorkspaceRole | null | undefined,
): WorkspaceCapabilities {
  return {
    role: role ?? null,
    // Components are also rendered in isolation by the editor lab and tests.
    // The authenticated application always has a role before mounting them.
    canEdit: role ? role !== "VIEWER" : true,
    canShare: role === "OWNER" || role === "ADMIN",
    canManageMembers: role === "OWNER" || role === "ADMIN",
    canDeleteWorkspace: role === "OWNER",
  };
}

export function useWorkspaceCapabilities(): WorkspaceCapabilities {
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const role = useAuthStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === activeWorkspaceId)
        ?.role,
  );
  return capabilitiesForRole(role);
}
