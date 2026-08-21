import { useEffect, useState } from "react";
import {
  sendCollaborationCursor,
  startDocumentCollaboration,
  stopDocumentCollaboration,
} from "../../services/documentCollaboration";
import { useAuthStore } from "../../stores/useAuthStore";
import { useCollaborationStore } from "../../stores/useCollaborationStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useAppStore } from "../../stores/useAppStore";

export function CollaborationLayer() {
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const activeTopTab = useAppStore((state) => state.activeTopTab);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const workspaces = useAuthStore((state) => state.workspaces);
  const role = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId,
  )?.role;
  const phase = useCollaborationStore((state) => state.phase);
  const connectionError = useCollaborationStore((state) => state.error);
  const participants = useCollaborationStore((state) => state.participants);
  const cursors = useCollaborationStore((state) => state.cursors);
  const [layoutRevision, setLayoutRevision] = useState(0);

  useEffect(() => {
    if (activeTopTab !== "current-note" || !activeDocumentId || !role) {
      stopDocumentCollaboration();
      return;
    }
    startDocumentCollaboration({ documentId: activeDocumentId, role });
    return () => stopDocumentCollaboration();
  }, [activeDocumentId, activeTopTab, role]);

  useEffect(() => {
    const pointerMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const page = target?.closest<HTMLElement>("[data-page-id]");
      if (!page) return;
      const rect = page.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      sendCollaborationCursor({
        pageId: page.dataset.pageId ?? "",
        x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
        y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
      });
    };
    const refreshLayout = () => setLayoutRevision((current) => current + 1);
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("scroll", refreshLayout, true);
    window.addEventListener("resize", refreshLayout);
    return () => {
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("scroll", refreshLayout, true);
      window.removeEventListener("resize", refreshLayout);
    };
  }, []);

  const visibleCursors = Object.values(cursors).flatMap((remoteCursor) => {
    const page = [...document.querySelectorAll<HTMLElement>("[data-page-id]")]
      .find((element) => element.dataset.pageId === remoteCursor.cursor.pageId);
    if (!page) return [];
    const rect = page.getBoundingClientRect();
    return [
      {
        ...remoteCursor,
        left: rect.left + (remoteCursor.cursor.x / 100) * rect.width,
        top: rect.top + (remoteCursor.cursor.y / 100) * rect.height,
        layoutRevision,
      },
    ];
  });
  const connectionLabel =
    phase === "connected"
      ? `${participants.length} online`
      : phase === "connecting"
        ? "Conectando colaboração"
        : phase === "error"
          ? "Colaboração indisponível"
          : "Colaboração offline";

  if (activeTopTab !== "current-note") return null;

  return (
    <>
      <div
        className="collaboration-presence"
        data-phase={phase}
        aria-label="Pessoas online"
        title={connectionError ?? connectionLabel}
      >
        <span className="collaboration-status-dot" />
        <span>{connectionLabel}</span>
        {(phase === "error" || phase === "disconnected") &&
          activeDocumentId &&
          role && (
            <button
              type="button"
              className="collaboration-retry-button"
              onClick={() =>
                startDocumentCollaboration({
                  documentId: activeDocumentId,
                  role,
                })
              }
            >
              Tentar novamente
            </button>
          )}
        <div className="collaboration-avatars">
          {participants.slice(0, 4).map((participant) => (
            <span
              key={participant.socketId}
              title={participant.user.name}
              style={{ backgroundColor: participant.color }}
            >
              {participant.user.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
      </div>
      <div className="remote-cursor-layer" aria-hidden="true">
        {visibleCursors.map((cursor) => (
          <div
            className="remote-cursor"
            key={cursor.user.id}
            style={{ left: cursor.left, top: cursor.top, color: cursor.color }}
          >
            <svg viewBox="0 0 18 24" width="18" height="24">
              <path d="M2 1 16 14l-7 1-4 7Z" fill="currentColor" stroke="white" strokeWidth="1.5" />
            </svg>
            <span style={{ backgroundColor: cursor.color }}>{cursor.user.name}</span>
          </div>
        ))}
      </div>
    </>
  );
}
