import { useEffect, useState } from "react";
import { MailPlus, Plus, RefreshCw, Save, Trash2, Users } from "lucide-react";
import { useWorkspaceCapabilities } from "../../hooks/useWorkspaceCapabilities";
import {
  buildInvitationUrl,
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
  type WorkspaceInvitation,
} from "../../services/sharing";
import {
  createWorkspace,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMember,
  type WorkspaceMembership,
} from "../../services/workspaces";
import { useAuthStore, type WorkspaceRole } from "../../stores/useAuthStore";
import { displayWorkspaceName, workspaceRoleLabel } from "../../utils/workspace.utils";
import { copyTextToClipboard } from "../../utils/clipboard.utils";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";

const assignableRoles: WorkspaceRole[] = ["ADMIN", "EDITOR", "VIEWER"];

export function WorkspaceSettings() {
  const workspaces = useAuthStore((state) => state.workspaces);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { role, canManageMembers } = useWorkspaceCapabilities();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>({});
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<WorkspaceRole, "OWNER">>("EDITOR");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<WorkspaceMembership | null>(null);

  const load = async () => {
    if (!activeWorkspaceId) return;
    const [memberResponse, invitationResponse] = await Promise.all([
      listWorkspaceMembers(activeWorkspaceId),
      canManageMembers
        ? listWorkspaceInvitations(activeWorkspaceId)
        : Promise.resolve({ ok: true as const, data: [] }),
    ]);
    if (memberResponse.ok) setMembers(memberResponse.data);
    else setFeedback(readApiError(memberResponse.error));
    if (invitationResponse.ok) setInvitations(invitationResponse.data);
  };

  useEffect(() => {
    if (!activeWorkspaceId) return;
    let active = true;
    void loadWorkspaceAccess(activeWorkspaceId, canManageMembers).then(
      ([memberResponse, invitationResponse]) => {
        if (!active) return;
        if (memberResponse.ok) setMembers(memberResponse.data);
        else setFeedback(readApiError(memberResponse.error));
        if (invitationResponse.ok) setInvitations(invitationResponse.data);
      },
    );
    return () => {
      active = false;
    };
  }, [activeWorkspaceId, canManageMembers]);

  if (!activeWorkspace) return null;
  const persistedWorkspaceName = displayWorkspaceName(activeWorkspace.name);
  const workspaceName = workspaceNames[activeWorkspace.id] ?? persistedWorkspaceName;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workspace-settings-grid">
      <section className="product-panel workspace-profile-panel">
        <span className="product-eyebrow">Espaço ativo</span>
        <h2>{displayWorkspaceName(activeWorkspace.name)}</h2>
        <p>Organize documentos, pessoas e permissões em um mesmo ambiente.</p>

        {role === "OWNER" || role === "ADMIN" ? (
          <form
            className="product-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              const name = workspaceName.trim();
              if (name.length < 2 || name === persistedWorkspaceName) return;
              void run(async () => {
                const response = await updateWorkspace(activeWorkspace.id, name);
                if (!response.ok) {
                  setFeedback(readApiError(response.error));
                  return;
                }
                await hydrateSession();
                setFeedback("Nome do espaço atualizado.");
              });
            }}
          >
            <label htmlFor="workspace-name">Nome do espaço</label>
            <div>
              <input
                id="workspace-name"
                value={workspaceName}
                minLength={2}
                maxLength={80}
                onChange={(event) =>
                  setWorkspaceNames((current) => ({
                    ...current,
                    [activeWorkspace.id]: event.target.value,
                  }))
                }
              />
              <button
                type="submit"
                disabled={
                  busy ||
                  workspaceName.trim().length < 2 ||
                  workspaceName.trim() === persistedWorkspaceName
                }
              >
                <Save size={16} aria-hidden="true" /> Salvar
              </button>
            </div>
          </form>
        ) : (
          <div className="product-readonly-note">Você pode consultar este espaço, mas não alterar suas configurações.</div>
        )}

        <form
          className="product-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const name = newWorkspaceName.trim();
            if (name.length < 2) return;
            void run(async () => {
              const response = await createWorkspace(name);
              if (!response.ok) {
                setFeedback(readApiError(response.error));
                return;
              }
              await hydrateSession();
              setActiveWorkspace(response.data.id);
              setNewWorkspaceName("");
              setFeedback("Novo espaço criado.");
            });
          }}
        >
          <label htmlFor="new-workspace-name">Criar outro espaço</label>
          <div>
            <input
              id="new-workspace-name"
              value={newWorkspaceName}
              minLength={2}
              maxLength={80}
              placeholder="Ex.: Planejamento pessoal"
              onChange={(event) => setNewWorkspaceName(event.target.value)}
            />
            <button type="submit" disabled={busy || newWorkspaceName.trim().length < 2}>
              <Plus size={16} aria-hidden="true" /> Criar
            </button>
          </div>
        </form>

        <div className="workspace-switch-list" aria-label="Seus espaços">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              data-active={workspace.id === activeWorkspaceId}
              onClick={() => setActiveWorkspace(workspace.id)}
            >
              <span>{displayWorkspaceName(workspace.name)}</span>
              <small>{workspaceRoleLabel(workspace.role)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="product-panel workspace-members-panel">
        <header className="product-panel-header">
          <div>
            <span className="product-eyebrow">Equipe</span>
            <h2><Users size={20} aria-hidden="true" /> Membros</h2>
          </div>
          <button type="button" className="product-icon-button" aria-label="Atualizar membros" onClick={() => void load()}>
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="workspace-member-list">
          {members.map((membership) => {
            const isOwner = membership.role === "OWNER";
            const canManageTarget = canManageMembers && (!isOwner || role === "OWNER");
            return (
              <article key={membership.id} className="workspace-member-row">
                <span className="workspace-member-avatar" aria-hidden="true">
                  {membership.user.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong>{membership.user.name}{membership.user.id === currentUserId ? " (você)" : ""}</strong>
                  <small>{membership.user.email}</small>
                </div>
                {canManageTarget ? (
                  <select
                    aria-label={`Permissão de ${membership.user.name}`}
                    value={membership.role}
                    disabled={busy}
                    onChange={(event) => {
                      const nextRole = event.target.value as WorkspaceRole;
                      void run(async () => {
                        const response = await updateWorkspaceMember(activeWorkspace.id, membership.id, nextRole);
                        if (!response.ok) setFeedback(readApiError(response.error));
                        await load();
                      });
                    }}
                  >
                    {role === "OWNER" && <option value="OWNER">Proprietário</option>}
                    {assignableRoles.map((option) => (
                      <option key={option} value={option}>{workspaceRoleLabel(option)}</option>
                    ))}
                  </select>
                ) : (
                  <span className="workspace-role-badge">{workspaceRoleLabel(membership.role)}</span>
                )}
                {canManageTarget && membership.user.id !== currentUserId && (
                  <button
                    type="button"
                    className="product-icon-button danger"
                    aria-label={`Remover ${membership.user.name}`}
                    onClick={() => setMemberPendingRemoval(membership)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </article>
            );
          })}
        </div>

        {canManageMembers && (
          <form
            className="workspace-invite-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const response = await createWorkspaceInvitation({
                  workspaceId: activeWorkspace.id,
                  email: inviteEmail.trim(),
                  role: inviteRole,
                });
                if (!response.ok) {
                  setFeedback(readApiError(response.error));
                  return;
                }
                const url = response.data.token ? buildInvitationUrl(response.data.token) : null;
                setGeneratedInviteUrl(url);
                const copied = url ? await copyTextToClipboard(url) : false;
                setInviteEmail("");
                setFeedback(copied ? "Convite criado e link copiado." : "Convite criado. Abra o compartilhamento para copiar o link.");
                await load();
              });
            }}
          >
            <label htmlFor="invite-email"><MailPlus size={16} aria-hidden="true" /> Convidar pessoa</label>
            <div>
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                placeholder="pessoa@exemplo.com"
                onChange={(event) => setInviteEmail(event.target.value)}
              />
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Exclude<WorkspaceRole, "OWNER">)}>
                {assignableRoles.map((option) => (
                  <option key={option} value={option}>{workspaceRoleLabel(option)}</option>
                ))}
              </select>
              <button type="submit" disabled={busy || !inviteEmail.trim()}>Convidar</button>
            </div>
          </form>
        )}

        {canManageMembers && generatedInviteUrl && (
          <div className="workspace-generated-invite">
            <label htmlFor="workspace-generated-invite">Link do último convite</label>
            <div>
              <input id="workspace-generated-invite" readOnly value={generatedInviteUrl} />
              <button type="button" onClick={() => void copyTextToClipboard(generatedInviteUrl).then((copied) => copied && setFeedback("Link copiado."))}>Copiar</button>
            </div>
          </div>
        )}

        {canManageMembers && invitations.some((invitation) => invitation.status === "PENDING") && (
          <div className="workspace-invitation-list">
            <strong>Convites pendentes</strong>
            {invitations.filter((invitation) => invitation.status === "PENDING").map((invitation) => (
              <div key={invitation.id}>
                <span>{invitation.email}</span>
                <small>{workspaceRoleLabel(invitation.role)}</small>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(async () => {
                    const response = await revokeWorkspaceInvitation(activeWorkspace.id, invitation.id);
                    if (!response.ok) setFeedback(readApiError(response.error));
                    await load();
                  })}
                >Revogar</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {feedback && <p className="product-feedback" role="status">{feedback}</p>}

      <ConfirmationDialog
        open={memberPendingRemoval !== null}
        title="Remover membro"
        description={memberPendingRemoval ? `${memberPendingRemoval.user.name} perderá o acesso aos documentos deste espaço.` : ""}
        confirmLabel="Remover acesso"
        variant="danger"
        onCancel={() => setMemberPendingRemoval(null)}
        onConfirm={() => {
          const membership = memberPendingRemoval;
          setMemberPendingRemoval(null);
          if (!membership) return;
          void run(async () => {
            const response = await removeWorkspaceMember(activeWorkspace.id, membership.id);
            if (!response.ok) setFeedback(readApiError(response.error));
            else setFeedback("Acesso removido.");
            await load();
          });
        }}
      />
    </div>
  );
}

function readApiError(error: string): string {
  try {
    const parsed = JSON.parse(error) as { message?: string | string[] };
    const message = Array.isArray(parsed.message) ? parsed.message.join(" ") : parsed.message;
    if (!message) return "Não foi possível concluir a ação.";
    if (message.includes("already a workspace member")) return "Esta pessoa já faz parte do espaço.";
    if (message.includes("email address that received")) return "Entre com o e-mail que recebeu o convite.";
    if (message.includes("at least one owner")) return "O espaço precisa manter pelo menos um proprietário.";
    return message;
  } catch {
    return error || "Não foi possível concluir a ação.";
  }
}

function loadWorkspaceAccess(workspaceId: string, canManageMembers: boolean) {
  return Promise.all([
    listWorkspaceMembers(workspaceId),
    canManageMembers
      ? listWorkspaceInvitations(workspaceId)
      : Promise.resolve({ ok: true as const, data: [] as WorkspaceInvitation[] }),
  ]);
}
