import type { WorkspaceRole } from "../stores/useAuthStore";

const roleLabels: Record<WorkspaceRole, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  EDITOR: "Editor",
  VIEWER: "Somente leitura",
};

export function workspaceRoleLabel(role: WorkspaceRole): string {
  return roleLabels[role];
}

export function displayWorkspaceName(name: string): string {
  const personalMatch = name.match(/^(.+)'s workspace$/i);
  return personalMatch ? `Espaço de ${personalMatch[1]}` : name;
}
