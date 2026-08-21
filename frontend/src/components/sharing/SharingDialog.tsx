import { useEffect, useState, type FormEvent } from "react";
import {
  buildInvitationUrl,
  buildPublicShareUrl,
  createShareLink,
  createWorkspaceInvitation,
  listShareLinks,
  listWorkspaceInvitations,
  revokeShareLink,
  revokeWorkspaceInvitation,
  type ShareLink,
  type WorkspaceInvitation,
} from "../../services/sharing";
import type { WorkspaceRole } from "../../stores/useAuthStore";
import { workspaceRoleLabel } from "../../utils/workspace.utils";
import { copyTextToClipboard } from "../../utils/clipboard.utils";

interface SharingDialogProps {
  documentId: string;
  workspaceId: string;
  role: WorkspaceRole;
  onClose: () => void;
}

export function SharingDialog({
  documentId,
  workspaceId,
  role,
  onClose,
}: SharingDialogProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<WorkspaceRole, "OWNER">>("VIEWER");
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [generatedInvitationUrl, setGeneratedInvitationUrl] = useState<string | null>(null);
  const [copiedKind, setCopiedKind] = useState<"share" | "invitation" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canInvite = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    let active = true;
    void Promise.all([
      listShareLinks(documentId),
      canInvite
        ? listWorkspaceInvitations(workspaceId)
        : Promise.resolve({ ok: true as const, data: [] }),
    ]).then(([linkResponse, invitationResponse]) => {
      if (!active) return;
      if (linkResponse.ok) setLinks(linkResponse.data);
      else setError(readApiError(linkResponse.error));
      if (invitationResponse.ok) setInvitations(invitationResponse.data);
    });
    return () => {
      active = false;
    };
  }, [canInvite, documentId, workspaceId]);

  const createReadonlyLink = async () => {
    setBusy(true);
    setError(null);
    const response = await createShareLink(documentId, 30);
    setBusy(false);
    if (!response.ok || !response.data.token) {
      setError(readApiError(response.ok ? "Token ausente." : response.error));
      return;
    }
    setLinks((current) => [response.data, ...current]);
    setGeneratedShareUrl(buildPublicShareUrl(response.data.token));
    setCopiedKind(null);
  };

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await createWorkspaceInvitation({
      workspaceId,
      email,
      role: inviteRole,
      expiresInDays: 7,
    });
    setBusy(false);
    if (!response.ok || !response.data.token) {
      setError(readApiError(response.ok ? "Token ausente." : response.error));
      return;
    }
    setInvitations((current) => [response.data, ...current]);
    setGeneratedInvitationUrl(buildInvitationUrl(response.data.token));
    setCopiedKind(null);
    setEmail("");
  };

  return (
    <div className="sharing-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="sharing-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sharing-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Colaboração</span>
            <h2 id="sharing-title">Compartilhar documento</h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>×</button>
        </header>

        {generatedShareUrl && (
          <div className="sharing-generated-link">
            <div><strong>Link público do documento</strong><small>Somente leitura · válido por 30 dias</small></div>
            <input readOnly aria-label="Link público gerado" value={generatedShareUrl} />
            <button type="button" onClick={() => void copyTextToClipboard(generatedShareUrl).then((copied) => copied && setCopiedKind("share"))}>
              {copiedKind === "share" ? "Copiado" : "Copiar"}
            </button>
          </div>
        )}
        {generatedInvitationUrl && (
          <div className="sharing-generated-link">
            <div><strong>Convite para o espaço</strong><small>Concede acesso a todos os documentos deste espaço</small></div>
            <input readOnly aria-label="Link de convite gerado" value={generatedInvitationUrl} />
            <button type="button" onClick={() => void copyTextToClipboard(generatedInvitationUrl).then((copied) => copied && setCopiedKind("invitation"))}>
              {copiedKind === "invitation" ? "Copiado" : "Copiar"}
            </button>
          </div>
        )}
        {error && <p className="sharing-error" role="alert">{error}</p>}

        <section>
          <div className="sharing-section-title">
            <div>
              <h3>Links somente leitura</h3>
              <p>Qualquer pessoa com o link pode visualizar, sem editar.</p>
            </div>
            <button type="button" disabled={busy} onClick={() => void createReadonlyLink()}>
              Criar link
            </button>
          </div>
          <div className="sharing-list">
            {links.filter((link) => !link.revokedAt).map((link) => (
              <article key={link.id}>
                <div>
                  <strong>Somente leitura</strong>
                  <span>Criado por {link.createdBy.name} · expira {formatDate(link.expiresAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const response = await revokeShareLink(documentId, link.id);
                    if (response.ok) {
                      setLinks((current) => current.filter((item) => item.id !== link.id));
                    }
                  }}
                >
                  Revogar
                </button>
              </article>
            ))}
          </div>
        </section>

        {canInvite && (
          <section>
            <h3>Convidar para o espaço</h3>
            <p className="sharing-scope-warning">O convite dá acesso ao espaço inteiro, não apenas a este documento.</p>
            <form className="sharing-invite-form" onSubmit={(event) => void invite(event)}>
              <input
                type="email"
                required
                placeholder="pessoa@exemplo.com"
                aria-label="E-mail do convite"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <select
                aria-label="Permissão do convite"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as Exclude<WorkspaceRole, "OWNER">)}
              >
                <option value="VIEWER">Pode visualizar</option>
                <option value="EDITOR">Pode editar</option>
                <option value="ADMIN">Pode administrar</option>
              </select>
              <button type="submit" disabled={busy}>Convidar</button>
            </form>
            <div className="sharing-list">
              {invitations.filter((invitation) => invitation.status === "PENDING").map((invitation) => (
                <article key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <span>{workspaceRoleLabel(invitation.role)} · expira {formatDate(invitation.expiresAt)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const response = await revokeWorkspaceInvitation(workspaceId, invitation.id);
                      if (response.ok) {
                        setInvitations((current) => current.filter((item) => item.id !== invitation.id));
                      }
                    }}
                  >
                    Cancelar
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "nunca";
}

function readApiError(value: string): string {
  try {
    const parsed = JSON.parse(value) as { message?: string | string[] };
    return Array.isArray(parsed.message)
      ? parsed.message.join(" ")
      : parsed.message ?? value;
  } catch {
    return value;
  }
}
