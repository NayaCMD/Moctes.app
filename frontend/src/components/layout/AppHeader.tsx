import {
  ChevronDown,
  ClipboardList,
  Ellipsis,
  History,
  LogOut,
  NotebookTabs,
  PanelsTopLeft,
  Settings,
  Share2,
  StickyNote,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useIsCompactTouchEditor } from "../../hooks/useResponsiveEditor";
import moctesLogo from "../../assets/moctes-logo.svg";
import { useAppStore } from "../../stores/useAppStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { DocumentType } from "../../types/document.types";
import { useWorkspaceCapabilities } from "../../hooks/useWorkspaceCapabilities";
import {
  displayWorkspaceName,
  workspaceRoleLabel,
} from "../../utils/workspace.utils";
import { SharingDialog } from "../sharing/SharingDialog";
import { DocumentRevisionHistory } from "../sync/DocumentRevisionHistory";
import { DocumentSyncStatus } from "../sync/DocumentSyncStatus";
import { DropdownMenu } from "../ui/DropdownMenu";
import { TopDock } from "./TopDock";

const documentModes: Array<{
  id: DocumentType;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof NotebookTabs;
}> = [
  {
    id: "notebook",
    label: "Caderno",
    shortLabel: "Caderno",
    description: "Páginas organizadas em seções com divisórias",
    icon: NotebookTabs,
  },
  {
    id: "notepad",
    label: "Bloco de Notas",
    shortLabel: "Bloco",
    description: "Anotações rápidas em páginas sequenciais",
    icon: StickyNote,
  },
  {
    id: "clipboard",
    label: "Prancheta",
    shortLabel: "Prancheta",
    description: "Quadro visual livre para organizar ideias",
    icon: ClipboardList,
  },
];

export function AppHeader() {
  const isCompactTouchEditor = useIsCompactTouchEditor();
  const user = useAuthStore((state) => state.user);
  const workspaces = useAuthStore((state) => state.workspaces);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const logout = useAuthStore((state) => state.logout);
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const setActiveDocument = useDocumentStore((state) => state.setActiveDocument);
  const createDocument = useDocumentStore((state) => state.createDocument);
  const setActiveDocumentType = useAppStore((state) => state.setActiveDocumentType);
  const activeTopTab = useAppStore((state) => state.activeTopTab);
  const setActiveTopTab = useAppStore((state) => state.setActiveTopTab);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
  const setEditingTextElementId = useEditorStore((state) => state.setEditingTextElementId);
  const cancelAssetDrag = useEditorStore((state) => state.cancelAssetDrag);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const { canEdit, canShare } = useWorkspaceCapabilities();

  const activeDocument =
    documents.find((document) => document.id === activeDocumentId) ?? documents[0];
  const activeWorkspace = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId,
  );
  if (!user || !activeWorkspace || !activeDocument) return null;
  const isEditor = activeTopTab === "current-note";
  const areaLabel =
    activeTopTab === "favorites" ? "Favoritos" :
    activeTopTab === "files" ? "Documentos" :
    activeTopTab === "calendar" ? "Calendário" :
    activeTopTab === "settings" ? "Espaço e equipe" :
    activeTopTab === "user" ? "Sua conta" : activeDocument.title;

  const switchDocumentMode = (mode: DocumentType) => {
    let documentForMode = documents.find((document) => document.type === mode);
    if (!documentForMode && canEdit) {
      const documentId = createDocument(mode);
      documentForMode = useDocumentStore.getState().documents.find(
        (document) => document.id === documentId,
      );
    }
    if (!documentForMode) return;
    cancelAssetDrag();
    closeContextMenu();
    setEditingTextElementId(null);
    setActiveDocument(documentForMode.id);
    setActiveDocumentType(mode);
    setActiveTopTab("current-note");
  };

  return (
    <>
      <header className="app-header" aria-label="Cabeçalho do Moctes">
        {isCompactTouchEditor ? (
          <div className="mobile-app-header">
            <DropdownMenu
              ariaLabel="Abrir navegação"
              align="start"
              className="mobile-header-navigation"
              triggerClassName="app-header-icon-action"
              trigger={<PanelsTopLeft size={20} aria-hidden="true" />}
            >
              {(close) => <TopDock onNavigate={close} />}
            </DropdownMenu>

            <div className="mobile-header-document" title={activeDocument.title}>
              <small>{isEditor ? documentModes.find((mode) => mode.id === activeDocument.type)?.label : "Área"}</small>
              <strong>{areaLabel}</strong>
            </div>

            {isEditor && <DocumentSyncStatus />}

            <DropdownMenu
              ariaLabel="Mais ações"
              className="mobile-header-actions"
              triggerClassName="app-header-icon-action"
              trigger={<Ellipsis size={21} aria-hidden="true" />}
            >
              {(close) => (
                <>
                  {isEditor && <div className="dropdown-menu-heading">Documento</div>}
                  {isEditor && documentModes.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={activeDocument.type === mode.id}
                        data-selected={activeDocument.type === mode.id}
                        onClick={() => {
                          switchDocumentMode(mode.id);
                          close();
                        }}
                      >
                        <Icon size={17} aria-hidden="true" />
                        {mode.label}
                      </button>
                    );
                  })}
                  <div className="dropdown-menu-separator" />
                  <div className="dropdown-menu-heading">Espaço</div>
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={workspace.id === activeWorkspaceId}
                      data-selected={workspace.id === activeWorkspaceId}
                      onClick={() => {
                        setActiveWorkspace(workspace.id);
                        close();
                      }}
                    >
                      <span>{displayWorkspaceName(workspace.name)}</span>
                      <small>{workspaceRoleLabel(workspace.role)}</small>
                    </button>
                  ))}
                  <div className="dropdown-menu-separator" />
                  {isEditor && canShare && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSharingOpen(true);
                        close();
                      }}
                    >
                      <Share2 size={17} aria-hidden="true" />
                      Compartilhar
                    </button>
                  )}
                  {isEditor && <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setHistoryOpen(true);
                      close();
                    }}
                  >
                    <History size={17} aria-hidden="true" />
                    Histórico de versões
                  </button>}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActiveTopTab("settings");
                      close();
                    }}
                  >
                    <Settings size={17} aria-hidden="true" />
                    Configurações
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActiveTopTab("user");
                      close();
                    }}
                  >
                    <UserRound size={17} aria-hidden="true" />
                    Conta
                  </button>
                  <div className="dropdown-menu-separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="dropdown-menu-danger"
                    onClick={() => void logout()}
                  >
                    <LogOut size={17} aria-hidden="true" />
                    Sair
                  </button>
                </>
              )}
            </DropdownMenu>
          </div>
        ) : (
          <>
        <div className="app-header-brand" aria-label="Moctes">
          <img src={moctesLogo} alt="" aria-hidden="true" />
          <span>Moctes</span>
        </div>

        <div className="app-header-document-context">
          <DropdownMenu
            ariaLabel="Trocar workspace"
            align="start"
            className="workspace-switcher"
            trigger={
              <>
                <span className="workspace-switcher-mark" aria-hidden="true">
                  {displayWorkspaceName(activeWorkspace.name)
                    .trim()
                    .charAt(0)
                    .toUpperCase() || "W"}
                </span>
                <span className="workspace-switcher-copy">
                  <small>Espaço</small>
                  <strong>{displayWorkspaceName(activeWorkspace.name)}</strong>
                </span>
                <ChevronDown size={15} aria-hidden="true" />
              </>
            }
          >
            {(close) => (
              <>
                <div className="dropdown-menu-heading">Seus espaços</div>
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={workspace.id === activeWorkspaceId}
                    data-selected={workspace.id === activeWorkspaceId}
                    onClick={() => {
                      setActiveWorkspace(workspace.id);
                      close();
                    }}
                  >
                    <span>{displayWorkspaceName(workspace.name)}</span>
                    <small>{workspaceRoleLabel(workspace.role)}</small>
                  </button>
                ))}
              </>
            )}
          </DropdownMenu>

          <span className="app-header-context-divider" aria-hidden="true" />
          <div className="app-header-document-title" title={activeDocument.title}>
            <small>{isEditor ? "Documento atual" : "Área"}</small>
            <strong>{areaLabel}</strong>
          </div>
        </div>

        {isEditor && <div className="context-switcher" aria-label="Tipo de documento" role="group">
          {documentModes.map((mode) => {
            const Icon = mode.icon;
            const selected = activeDocument.type === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-label={mode.label}
                title={mode.description}
                aria-pressed={selected}
                data-active={selected}
                onClick={() => switchDocumentMode(mode.id)}
              >
                <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>{mode.shortLabel}</span>
              </button>
            );
          })}
        </div>}

        <div className="app-header-actions">
          {isEditor && <DocumentSyncStatus />}

          {isEditor && canShare && (
            <button
              type="button"
              className="app-header-action app-header-share"
              onClick={() => setSharingOpen(true)}
            >
              <Share2 size={17} aria-hidden="true" />
              <span>Compartilhar</span>
            </button>
          )}

          <DropdownMenu
            ariaLabel="Abrir navegação"
            triggerClassName="app-header-icon-action"
            trigger={<PanelsTopLeft size={18} aria-hidden="true" />}
          >
            {(close) => <TopDock onNavigate={close} />}
          </DropdownMenu>

          <DropdownMenu
            ariaLabel="Abrir menu do usuário"
            className="user-menu"
            triggerClassName="user-menu-trigger"
            trigger={
              <>
                <span className="account-avatar" aria-hidden="true">
                  {user.name.trim().charAt(0).toUpperCase() || "M"}
                </span>
                <span className="user-menu-trigger-name">{user.name.split(" ")[0]}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </>
            }
          >
            {(close) => (
              <>
                <div className="user-menu-identity">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                  <span>{workspaceRoleLabel(activeWorkspace.role)}</span>
                </div>
                <div className="dropdown-menu-separator" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveTopTab("user");
                    close();
                  }}
                >
                  <UserRound size={16} aria-hidden="true" />
                  Conta
                </button>
                {isEditor && <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setHistoryOpen(true);
                    close();
                  }}
                >
                  <History size={16} aria-hidden="true" />
                  Histórico de versões
                </button>}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveTopTab("settings");
                    close();
                  }}
                >
                  <Settings size={16} aria-hidden="true" />
                  Configurações
                </button>
                <div className="dropdown-menu-separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="dropdown-menu-danger"
                  onClick={() => void logout()}
                >
                  <LogOut size={16} aria-hidden="true" />
                  Sair
                </button>
              </>
            )}
          </DropdownMenu>
        </div>
          </>
        )}
      </header>

      {isEditor && sharingOpen && canShare && (
        <SharingDialog
          documentId={activeDocument.id}
          workspaceId={activeWorkspace.id}
          role={activeWorkspace.role}
          onClose={() => setSharingOpen(false)}
        />
      )}
      {isEditor && historyOpen && (
        <DocumentRevisionHistory
          canRestore={activeWorkspace.role !== "VIEWER"}
          documentId={activeDocument.id}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}
