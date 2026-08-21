import { create } from "zustand";
import { apiGet, apiPost } from "../services/apiClient";
import { stopDocumentPersistence } from "../services/documentPersistence";
import { useDocumentStore } from "./useDocumentStore";
import { useEditorStore } from "./useEditorStore";

export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

interface AuthPrincipalResponse {
  sessionId: string;
  user: AuthUser;
  workspaces: AuthWorkspace[];
}

type SessionResponse =
  | ({ authenticated: true } & AuthPrincipalResponse)
  | { authenticated: false };

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload extends LoginPayload {
  name: string;
}

interface AuthState {
  phase: "loading" | "authenticated" | "unauthenticated" | "error";
  sessionMode: "online" | "offline";
  user: AuthUser | null;
  workspaces: AuthWorkspace[];
  activeWorkspaceId: string | null;
  error: string | null;
  hydrateSession: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  logout: () => Promise<void>;
  setActiveWorkspace: (workspaceId: string) => void;
}

const ACTIVE_WORKSPACE_KEY = "moctes-active-workspace";
const AUTH_CACHE_KEY = "moctes-auth-principal-v1";
const DOCUMENT_CACHE_KEY = "moctes-documents-v1";
const DOCUMENT_SCOPE_KEY = "moctes-cache-scope";

export const useAuthStore = create<AuthState>((set, get) => ({
  phase: "loading",
  sessionMode: "online",
  user: null,
  workspaces: [],
  activeWorkspaceId: null,
  error: null,

  hydrateSession: async () => {
    set({ phase: "loading", error: null });
    const response = await apiGet<SessionResponse>("/auth/session");
    if (!response.ok) {
      const cachedPrincipal = readCachedPrincipal();
      if (response.status === 0 && cachedPrincipal) {
        applyPrincipal(set, cachedPrincipal, "offline");
        return;
      }
      set({
        phase: response.status === 0 ? "error" : "unauthenticated",
        sessionMode: "online",
        error: response.status === 0 ? response.error : null,
        user: null,
        workspaces: [],
        activeWorkspaceId: null,
      });
      return;
    }
    if (!response.data.authenticated) {
      setUnauthenticated(set);
      return;
    }
    applyPrincipal(set, response.data);
  },

  login: async (payload) => {
    set({ phase: "loading", error: null });
    const response = await apiPost<LoginPayload, AuthPrincipalResponse>(
      "/auth/login",
      payload,
    );
    if (!response.ok) {
      set({
        phase: "unauthenticated",
        error: friendlyAuthError(response.error),
      });
      return false;
    }
    applyPrincipal(set, response.data);
    return true;
  },

  register: async (payload) => {
    set({ phase: "loading", error: null });
    const response = await apiPost<RegisterPayload, AuthPrincipalResponse>(
      "/auth/register",
      payload,
    );
    if (!response.ok) {
      set({
        phase: "unauthenticated",
        error: friendlyAuthError(response.error),
      });
      return false;
    }
    applyPrincipal(set, response.data);
    return true;
  },

  logout: async () => {
    stopDocumentPersistence();
    await apiPost("/auth/logout");
    useDocumentStore.getState().restoreDemoDocuments();
    useEditorStore.setState({ undoStack: [], redoStack: [] });
    window.localStorage.removeItem(DOCUMENT_CACHE_KEY);
    window.localStorage.removeItem(DOCUMENT_SCOPE_KEY);
    window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    window.localStorage.removeItem(AUTH_CACHE_KEY);
    setUnauthenticated(set);
  },

  setActiveWorkspace: (workspaceId) => {
    if (!get().workspaces.some((workspace) => workspace.id === workspaceId)) {
      return;
    }
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    set({ activeWorkspaceId: workspaceId });
  },
}));

type AuthSetter = (
  partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>),
) => void;

function applyPrincipal(
  set: AuthSetter,
  principal: AuthPrincipalResponse,
  sessionMode: AuthState["sessionMode"] = "online",
): void {
  const storedWorkspaceId = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  const activeWorkspaceId =
    principal.workspaces.find((workspace) => workspace.id === storedWorkspaceId)
      ?.id ??
    principal.workspaces[0]?.id ??
    null;
  if (activeWorkspaceId) {
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, activeWorkspaceId);
  }
  set({
    phase: "authenticated",
    sessionMode,
    user: principal.user,
    workspaces: principal.workspaces,
    activeWorkspaceId,
    error: null,
  });
  window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(principal));
}

function setUnauthenticated(set: AuthSetter): void {
  window.localStorage.removeItem(AUTH_CACHE_KEY);
  set({
    phase: "unauthenticated",
    sessionMode: "online",
    user: null,
    workspaces: [],
    activeWorkspaceId: null,
    error: null,
  });
}

function readCachedPrincipal(): AuthPrincipalResponse | null {
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AuthPrincipalResponse>;
    if (
      typeof value.sessionId !== "string" ||
      !value.user ||
      typeof value.user.id !== "string" ||
      !Array.isArray(value.workspaces) ||
      value.workspaces.length === 0
    ) {
      return null;
    }
    return value as AuthPrincipalResponse;
  } catch {
    return null;
  }
}

function friendlyAuthError(error: string): string {
  try {
    const parsed = JSON.parse(error) as { message?: string | string[] };
    const message = Array.isArray(parsed.message)
      ? parsed.message.join(" ")
      : parsed.message ?? error;
    return translateAuthMessage(message);
  } catch {
    return translateAuthMessage(error);
  }
}

function translateAuthMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid email or password")) {
    return "E-mail ou senha inválidos.";
  }
  if (normalized.includes("already exists") || normalized.includes("unique constraint")) {
    return "Já existe uma conta com este e-mail.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return message;
}
