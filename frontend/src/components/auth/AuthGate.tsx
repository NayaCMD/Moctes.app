import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  startDocumentPersistence,
  stopDocumentPersistence,
} from "../../services/documentPersistence";
import { useAuthStore } from "../../stores/useAuthStore";
import { DocumentConflictDialog } from "../sync/DocumentConflictDialog";
import { loadWorkspaceAssets } from "../../services/assetPersistence";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
import {
  cacheWorkspaceAssets,
  loadCachedWorkspaceAssets,
} from "../../services/assetOfflineCache";
import {
  migrateLegacyImportedAssets,
  reconcilePendingAssetMigrations,
} from "../../services/assetMigration";
import { CollaborationLayer } from "../collaboration/CollaborationLayer";

export function AuthGate({ children }: { children: ReactNode }) {
  const phase = useAuthStore((state) => state.phase);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  if (phase === "authenticated") {
    return <AuthenticatedApp>{children}</AuthenticatedApp>;
  }
  if (phase === "loading") {
    return <AuthStatus message="Carregando sua sessão…" />;
  }
  return <AuthForm invitationMode={window.location.pathname.startsWith("/invite/")} />;
}

function AuthenticatedApp({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const currentScope =
    user && activeWorkspaceId ? `${user.id}:${activeWorkspaceId}` : null;

  useEffect(() => {
    if (!user || !activeWorkspaceId) {
      return;
    }
    const scope = `${user.id}:${activeWorkspaceId}`;
    let active = true;
    void Promise.all([
      startDocumentPersistence(activeWorkspaceId, user.id),
      hydrateWorkspaceAssets(scope, activeWorkspaceId, () => active),
    ]).finally(() => {
      if (active) {
        setReadyScope(scope);
        void migrateLegacyImportedAssets({
          scope,
          workspaceId: activeWorkspaceId,
          isActive: () => active,
        });
      }
    });
    const refreshProcessingAssets = () => {
      const hasProcessingAssets = useAssetLibraryStore
        .getState()
        .assets.some(
          (asset) =>
            asset.source === "remote" &&
            (asset.status === "PENDING" || asset.status === "PROCESSING"),
        );
      if (active && hasProcessingAssets) {
        void refreshWorkspaceAssets(scope, activeWorkspaceId, () => active);
      }
    };
    const pollInterval = window.setInterval(refreshProcessingAssets, 2_500);
    const resumeAssetWork = () => {
      refreshProcessingAssets();
      void migrateLegacyImportedAssets({
        scope,
        workspaceId: activeWorkspaceId,
        isActive: () => active,
      });
    };
    window.addEventListener("online", resumeAssetWork);
    return () => {
      active = false;
      window.clearInterval(pollInterval);
      window.removeEventListener("online", resumeAssetWork);
      stopDocumentPersistence();
    };
  }, [activeWorkspaceId, user]);

  if (!user || !activeWorkspaceId) {
    return (
      <AuthStatus message="Sua conta ainda não possui um espaço ativo." />
    );
  }
  if (readyScope !== currentScope) {
    return <AuthStatus message="Abrindo seu caderno…" />;
  }

  return (
    <>
      {children}
      <CollaborationLayer />
      <DocumentConflictDialog />
    </>
  );
}

async function hydrateWorkspaceAssets(
  scope: string,
  workspaceId: string,
  isActive: () => boolean,
): Promise<void> {
  const legacyAssets = useAssetLibraryStore.getState().assets;
  const cached = await loadCachedWorkspaceAssets({
    scope,
    workspaceId,
    legacyAssets,
  });
  if (!isActive()) {
    return;
  }
  useAssetLibraryStore.getState().replaceRemoteAssets(cached);

  const response = await loadWorkspaceAssets(workspaceId);
  if (!isActive() || !response.ok) {
    return;
  }
  useAssetLibraryStore.getState().replaceRemoteAssets(response.data);
  await reconcilePendingAssetMigrations({
    scope,
    workspaceId,
    isActive,
  });
  void cacheWorkspaceAssets(scope, response.data).catch(() => undefined);
}

async function refreshWorkspaceAssets(
  scope: string,
  workspaceId: string,
  isActive: () => boolean,
): Promise<void> {
  const response = await loadWorkspaceAssets(workspaceId);
  if (!isActive() || !response.ok) {
    return;
  }
  useAssetLibraryStore.getState().replaceRemoteAssets(response.data);
  await reconcilePendingAssetMigrations({
    scope,
    workspaceId,
    isActive,
  });
  void cacheWorkspaceAssets(scope, response.data).catch(() => undefined);
}

function AuthForm({ invitationMode = false }: { invitationMode?: boolean }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const phase = useAuthStore((state) => state.phase);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "register") {
      void register({ name, email, password });
    } else {
      void login({ email, password });
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">Moctes</div>
        {invitationMode && (
          <div className="auth-invitation-context">
            Você recebeu um convite. Entre ou crie uma conta usando exatamente o e-mail que recebeu o link.
          </div>
        )}
        <h1>{mode === "login" ? "Entre no seu caderno" : "Crie seu espaço"}</h1>
        <p>Seus documentos ficam organizados e protegidos em espaços.</p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Nome
              <input
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          <label>
            E-mail
            <input
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              type="password"
              minLength={mode === "register" ? 10 : undefined}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="auth-submit"
            disabled={phase === "loading"}
            type="submit"
          >
            {phase === "loading"
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>
        <button
          className="auth-switch"
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "Ainda não tenho uma conta"
            : "Já tenho uma conta"}
        </button>
      </section>
    </main>
  );
}

function AuthStatus({ message }: { message: string }) {
  return (
    <main className="auth-page">
      <section className="auth-card auth-status" aria-live="polite">
        <div className="auth-brand">Moctes</div>
        <p>{message}</p>
      </section>
    </main>
  );
}
