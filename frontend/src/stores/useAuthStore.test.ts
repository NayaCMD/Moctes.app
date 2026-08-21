import { beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "../services/apiClient";
import { useAuthStore } from "./useAuthStore";

vi.mock("../services/apiClient", async () => {
  const actual = await vi.importActual<typeof import("../services/apiClient")>("../services/apiClient");
  return { ...actual, apiGet: vi.fn(), apiPost: vi.fn() };
});

const apiGet = vi.mocked(apiClient.apiGet);

describe("useAuthStore offline session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.setState({
      phase: "loading",
      sessionMode: "online",
      user: null,
      workspaces: [],
      activeWorkspaceId: null,
      error: null,
    });
  });

  it("restaura a identidade local quando a API está offline", async () => {
    window.localStorage.setItem(
      "moctes-auth-principal-v1",
      JSON.stringify({
        sessionId: "session-1",
        user: { id: "user-1", name: "Ana", email: "ana@example.com" },
        workspaces: [
          { id: "workspace-1", name: "Espaço de Ana", slug: "ana", role: "OWNER" },
        ],
      }),
    );
    apiGet.mockResolvedValue({ ok: false, status: 0, error: "Network request failed" });

    await useAuthStore.getState().hydrateSession();

    expect(useAuthStore.getState()).toMatchObject({
      phase: "authenticated",
      sessionMode: "offline",
      user: { id: "user-1" },
      activeWorkspaceId: "workspace-1",
    });
  });

  it("não inventa uma sessão offline quando não existe cache", async () => {
    apiGet.mockResolvedValue({ ok: false, status: 0, error: "Network request failed" });

    await useAuthStore.getState().hydrateSession();

    expect(useAuthStore.getState()).toMatchObject({
      phase: "error",
      sessionMode: "online",
      user: null,
    });
  });
});
