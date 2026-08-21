import { useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  FolderOpen,
  NotebookTabs,
  Plus,
  Search,
  Star,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";
import { useWorkspaceCapabilities } from "../../hooks/useWorkspaceCapabilities";
import { useAppStore } from "../../stores/useAppStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import type {
  DocumentType,
  MoctesDocument,
  TopTab,
} from "../../types/document.types";
import {
  displayWorkspaceName,
  workspaceRoleLabel,
} from "../../utils/workspace.utils";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { WorkspaceSettings } from "./WorkspaceSettings";
import {
  loadDeletedDocuments,
  restoreDeletedDocument,
  type PersistedDocumentRecord,
} from "../../services/documentPersistence";

const typeDetails: Record<
  DocumentType,
  { label: string; description: string; icon: typeof NotebookTabs }
> = {
  notebook: {
    label: "Caderno",
    description: "Páginas em seções, com capa e divisórias",
    icon: NotebookTabs,
  },
  notepad: {
    label: "Bloco de notas",
    description: "Anotações rápidas em páginas sequenciais",
    icon: StickyNote,
  },
  clipboard: {
    label: "Prancheta",
    description: "Um quadro visual livre para organizar ideias",
    icon: ClipboardList,
  },
};

export function ProductArea({
  area,
}: {
  area: Exclude<TopTab, "current-note">;
}) {
  if (area === "settings") return <WorkspaceSettingsArea />;
  if (area === "user") return <AccountArea />;
  return <DocumentLibraryArea area={area} />;
}

function DocumentLibraryArea({
  area,
}: {
  area: "files" | "favorites" | "calendar";
}) {
  const documents = useDocumentStore((state) => state.documents);
  const setActiveDocument = useDocumentStore(
    (state) => state.setActiveDocument,
  );
  const createDocument = useDocumentStore((state) => state.createDocument);
  const updateDocument = useDocumentStore((state) => state.updateDocument);
  const deleteDocument = useDocumentStore((state) => state.deleteDocument);
  const setActiveTopTab = useAppStore((state) => state.setActiveTopTab);
  const setActiveDocumentType = useAppStore(
    (state) => state.setActiveDocumentType,
  );
  const { canEdit } = useWorkspaceCapabilities();
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MoctesDocument | null>(
    null,
  );
  const [trashOpen, setTrashOpen] = useState(false);
  const [deletedDocuments, setDeletedDocuments] = useState<
    PersistedDocumentRecord[]
  >([]);
  const [trashStatus, setTrashStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );

  const toggleTrash = () => {
    const nextOpen = !trashOpen;
    setTrashOpen(nextOpen);
    if (!nextOpen || !activeWorkspaceId) return;
    setTrashStatus("loading");
    void loadDeletedDocuments(activeWorkspaceId).then((response) => {
      if (response.ok) {
        setDeletedDocuments(response.data);
        setTrashStatus("idle");
      } else {
        setTrashStatus("error");
      }
    });
  };

  const filteredDocuments = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return documents
      .filter((document) => area !== "favorites" || document.favorite)
      .filter(
        (document) =>
          !normalized ||
          document.title.toLocaleLowerCase("pt-BR").includes(normalized),
      )
      .sort(
        (first, second) =>
          Date.parse(second.updatedAt) - Date.parse(first.updatedAt),
      );
  }, [area, documents, search]);

  const openDocument = (document: MoctesDocument) => {
    setActiveDocument(document.id);
    setActiveDocumentType(document.type);
    setActiveTopTab("current-note");
  };

  const title =
    area === "favorites"
      ? "Favoritos"
      : area === "calendar"
        ? "Calendário"
        : "Seus documentos";
  const description =
    area === "favorites"
      ? "Acesso rápido ao que você marcou como importante."
      : area === "calendar"
        ? "Encontre seus documentos pela última data de alteração."
        : "Crie, localize e continue de onde parou.";

  return (
    <main className="product-area">
      <header className="product-area-hero">
        <div>
          <span className="product-eyebrow">Biblioteca</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="product-primary-button"
            onClick={() => setCreateOpen((open) => !open)}
          >
            <Plus size={18} aria-hidden="true" /> Novo documento
          </button>
        )}
      </header>

      {createOpen && canEdit && (
        <section
          className="document-create-panel"
          aria-label="Escolher tipo do documento"
        >
          {Object.entries(typeDetails).map(([type, details]) => {
            const Icon = details.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  const documentId = createDocument(type as DocumentType);
                  const document = useDocumentStore
                    .getState()
                    .documents.find((item) => item.id === documentId);
                  if (document) openDocument(document);
                }}
              >
                <Icon size={22} aria-hidden="true" />
                <span>
                  <strong>{details.label}</strong>
                  <small>{details.description}</small>
                </span>
              </button>
            );
          })}
        </section>
      )}

      <label className="product-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Buscar documentos</span>
        <input
          value={search}
          placeholder="Buscar por título..."
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {area === "files" && (
        <section className="document-trash" aria-label="Lixeira de documentos">
          <button
            type="button"
            className="document-trash-toggle"
            aria-expanded={trashOpen}
            onClick={toggleTrash}
          >
            <Trash2 size={17} aria-hidden="true" />
            {trashOpen ? "Ocultar lixeira" : "Abrir lixeira"}
          </button>
          {trashOpen && (
            <div className="document-trash-panel">
              {trashStatus === "loading" ? (
                <p role="status">Carregando documentos excluídos…</p>
              ) : trashStatus === "error" ? (
                <p role="alert">Não foi possível carregar a lixeira.</p>
              ) : deletedDocuments.length === 0 ? (
                <p>A lixeira está vazia.</p>
              ) : (
                <ul>
                  {deletedDocuments.map((record) => (
                    <li key={record.id}>
                      <span>
                        <strong>{record.document.title}</strong>
                        <small>
                          Excluído em{" "}
                          {formatDate(record.deletedAt ?? record.updatedAt)}
                        </small>
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!activeWorkspaceId) return;
                            void restoreDeletedDocument(
                              activeWorkspaceId,
                              record.id,
                            ).then((response) => {
                              if (response.ok) {
                                setDeletedDocuments((current) =>
                                  current.filter(
                                    (item) => item.id !== record.id,
                                  ),
                                );
                              } else {
                                setTrashStatus("error");
                              }
                            });
                          }}
                        >
                          Restaurar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {area === "calendar" ? (
        <CalendarDocumentList
          documents={filteredDocuments}
          onOpen={openDocument}
        />
      ) : filteredDocuments.length > 0 ? (
        <div className="document-card-grid">
          {filteredDocuments.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              canEdit={canEdit}
              onOpen={() => openDocument(document)}
              onFavorite={() =>
                updateDocument(document.id, { favorite: !document.favorite })
              }
              onRename={(title) => updateDocument(document.id, { title })}
              onDelete={() => setPendingDelete(document)}
            />
          ))}
        </div>
      ) : (
        <section className="product-empty-state">
          {area === "favorites" ? (
            <Star size={30} aria-hidden="true" />
          ) : (
            <FolderOpen size={30} aria-hidden="true" />
          )}
          <h2>
            {search
              ? "Nenhum resultado"
              : area === "favorites"
                ? "Nenhum favorito ainda"
                : "Nenhum documento aqui"}
          </h2>
          <p>
            {search
              ? "Tente buscar com outro título."
              : "Marque um documento com a estrela para encontrá-lo rapidamente."}
          </p>
        </section>
      )}

      <ConfirmationDialog
        open={pendingDelete !== null}
        title="Excluir documento"
        description={
          documents.length <= 1
            ? "O Moctes mantém pelo menos um documento no espaço. Crie outro antes de excluir este."
            : `“${pendingDelete?.title ?? ""}” será movido para a lixeira e poderá ser restaurado.`
        }
        confirmLabel={
          documents.length <= 1 ? "Entendi" : "Mover para a lixeira"
        }
        variant={documents.length <= 1 ? "default" : "danger"}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete && documents.length > 1)
            deleteDocument(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </main>
  );
}

function DocumentCard({
  document,
  canEdit,
  onOpen,
  onFavorite,
  onRename,
  onDelete,
}: {
  document: MoctesDocument;
  canEdit: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(document.title);
  const details = typeDetails[document.type];
  const Icon = details.icon;

  return (
    <article className="document-card">
      <button type="button" className="document-card-open" onClick={onOpen}>
        <span
          className="document-card-cover"
          data-type={document.type}
          style={{ backgroundColor: document.coverColor }}
        >
          <Icon size={28} aria-hidden="true" />
        </span>
        <span className="document-card-copy">
          <small>{details.label}</small>
          <strong>{document.title}</strong>
          <span>
            {document.pages.length}{" "}
            {document.pages.length === 1 ? "página" : "páginas"} ·{" "}
            {formatDate(document.updatedAt)}
          </span>
        </span>
      </button>
      {renaming ? (
        <form
          className="document-card-rename"
          onSubmit={(event) => {
            event.preventDefault();
            const nextTitle = title.trim();
            if (nextTitle) onRename(nextTitle);
            setRenaming(false);
          }}
        >
          <input
            autoFocus
            value={title}
            maxLength={120}
            aria-label="Novo título"
            onChange={(event) => setTitle(event.target.value)}
          />
          <button type="submit">Salvar</button>
          <button
            type="button"
            onClick={() => {
              setTitle(document.title);
              setRenaming(false);
            }}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <footer>
          <button
            type="button"
            aria-label={
              document.favorite
                ? "Remover dos favoritos"
                : "Adicionar aos favoritos"
            }
            aria-pressed={document.favorite}
            onClick={onFavorite}
            disabled={!canEdit}
          >
            <Star
              size={17}
              fill={document.favorite ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
          {canEdit && (
            <button type="button" onClick={() => setRenaming(true)}>
              Renomear
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="danger"
              aria-label={`Excluir ${document.title}`}
              onClick={onDelete}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </footer>
      )}
    </article>
  );
}

function CalendarDocumentList({
  documents,
  onOpen,
}: {
  documents: MoctesDocument[];
  onOpen: (document: MoctesDocument) => void;
}) {
  const groups = useMemo(() => {
    const result = new Map<string, MoctesDocument[]>();
    documents.forEach((document) => {
      const key = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
      }).format(new Date(document.updatedAt));
      result.set(key, [...(result.get(key) ?? []), document]);
    });
    return [...result.entries()];
  }, [documents]);

  if (groups.length === 0)
    return (
      <section className="product-empty-state">
        <CalendarDays size={30} />
        <h2>Nenhum documento encontrado</h2>
        <p>Seus documentos aparecerão aqui agrupados por data.</p>
      </section>
    );

  return (
    <div className="calendar-document-list">
      {groups.map(([date, items]) => (
        <section key={date}>
          <h2>{date}</h2>
          {items.map((document) => (
            <button
              key={document.id}
              type="button"
              onClick={() => onOpen(document)}
            >
              <FileText size={18} aria-hidden="true" />
              <span>
                <strong>{document.title}</strong>
                <small>
                  {typeDetails[document.type].label} · {document.pages.length}{" "}
                  páginas
                </small>
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function AccountArea() {
  const user = useAuthStore((state) => state.user);
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const workspaces = useAuthStore((state) => state.workspaces);
  const logout = useAuthStore((state) => state.logout);
  if (!user) return null;
  return (
    <main className="product-area">
      <header className="product-area-hero">
        <div>
          <span className="product-eyebrow">Sua conta</span>
          <h1>Perfil e sessão</h1>
          <p>Confira a identidade usada para acessar seus cadernos.</p>
        </div>
      </header>
      <section className="product-panel account-panel">
        <span className="account-avatar">
          <UserRound size={30} />
        </span>
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="session-badge" data-mode={sessionMode}>
            {sessionMode === "offline" ? "Sessão offline" : "Sessão conectada"}
          </span>
        </div>
        <button type="button" onClick={() => void logout()}>
          Sair da conta
        </button>
      </section>
      <section className="product-panel">
        <h2>Espaços disponíveis</h2>
        <div className="account-workspace-list">
          {workspaces.map((workspace) => (
            <div key={workspace.id}>
              <span>{displayWorkspaceName(workspace.name)}</span>
              <small>{workspaceRoleLabel(workspace.role)}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function WorkspaceSettingsArea() {
  return (
    <main className="product-area">
      <header className="product-area-hero">
        <div>
          <span className="product-eyebrow">Administração</span>
          <h1>Espaço e equipe</h1>
          <p>Gerencie nomes, membros, convites e níveis de acesso.</p>
        </div>
      </header>
      <WorkspaceSettings />
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
