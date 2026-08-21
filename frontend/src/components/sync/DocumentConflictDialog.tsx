import { useEffect, useState } from "react";
import {
  loadDocumentConflictDetails,
  resolveDocumentConflict,
  type DocumentConflictDetails,
  type DocumentConflictResolution,
} from "../../services/documentPersistence";
import { useDocumentSyncStore } from "../../stores/useDocumentSyncStore";

interface ConflictLoadState {
  documentId: string;
  details: DocumentConflictDetails | null;
  error: string | null;
}

export function DocumentConflictDialog() {
  const documentId = useDocumentSyncStore(
    (state) => state.conflictDocumentIds[0] ?? null,
  );
  const operationId = useDocumentSyncStore((state) =>
    documentId ? state.conflictOperationIds[documentId] : undefined,
  );
  const [loadState, setLoadState] = useState<ConflictLoadState | null>(null);
  const [resolution, setResolution] =
    useState<DocumentConflictResolution | null>(null);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      return;
    }
    let active = true;
    void loadDocumentConflictDetails(documentId, operationId).then((response) => {
      if (!active) {
        return;
      }
      setLoadState({
        documentId,
        details: response.ok ? response.data : null,
        error: response.ok ? null : readableApiError(response.error),
      });
    });
    return () => {
      active = false;
    };
  }, [documentId, operationId]);

  if (!documentId) {
    return null;
  }
  const currentLoad = loadState?.documentId === documentId ? loadState : null;
  const details = currentLoad?.details ?? null;
  const isLoading = !currentLoad;

  const resolve = async (choice: DocumentConflictResolution) => {
    setResolution(choice);
    setResolutionError(null);
    const response = await resolveDocumentConflict(
      documentId,
      choice,
      operationId,
    );
    if (!response.ok) {
      setResolutionError(readableApiError(response.error));
      setResolution(null);
    }
  };

  return (
    <div className="sync-modal-backdrop">
      <section
        aria-labelledby="document-conflict-title"
        aria-modal="true"
        className="sync-modal conflict-dialog"
        role="dialog"
      >
        <header>
          <span>Sincronização interrompida</span>
          <h2 id="document-conflict-title">Escolha qual versão manter</h2>
          <p>
            As duas versões divergiram. Nenhuma alteração será sobrescrita sem sua
            decisão.
          </p>
        </header>

        {isLoading && <p className="sync-modal-state">Carregando versões…</p>}
        {currentLoad?.error && (
          <div className="sync-modal-error" role="alert">
            <strong>Não foi possível carregar a comparação.</strong>
            <p>{currentLoad.error}</p>
            <button
              type="button"
              onClick={() => {
                setLoadState(null);
                void loadDocumentConflictDetails(documentId, operationId).then(
                  (response) =>
                    setLoadState({
                      documentId,
                      details: response.ok ? response.data : null,
                      error: response.ok ? null : readableApiError(response.error),
                    }),
                );
              }}
            >
              Tentar carregar novamente
            </button>
          </div>
        )}
        {details && (
          <div className="conflict-comparison">
            <ConflictVersionCard
              label="Neste dispositivo"
              document={details.localDocument}
              deleted={details.operationKind === "delete"}
            />
            <ConflictVersionCard
              label="No servidor"
              document={details.remoteRecord?.document ?? null}
              deleted={!details.remoteRecord}
              version={details.remoteRecord?.version}
            />
          </div>
        )}

        {resolutionError && (
          <p className="sync-modal-error" role="alert">
            {resolutionError}
          </p>
        )}
        <footer>
          <button
            className="sync-secondary-action"
            disabled={!details || resolution !== null}
            type="button"
            onClick={() => void resolve("remote")}
          >
            {resolution === "remote" ? "Aplicando…" : "Usar versão do servidor"}
          </button>
          <button
            className="sync-primary-action"
            disabled={!details || resolution !== null}
            type="button"
            onClick={() => void resolve("local")}
          >
            {resolution === "local" ? "Enviando…" : "Manter minha versão"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ConflictVersionCard({
  label,
  document,
  deleted,
  version,
}: {
  label: string;
  document: DocumentConflictDetails["localDocument"];
  deleted: boolean;
  version?: number;
}) {
  const elementCount =
    document?.pages.reduce((total, page) => total + page.elements.length, 0) ?? 0;
  return (
    <article data-deleted={deleted}>
      <span>{label}</span>
      {deleted || !document ? (
        <>
          <strong>Documento excluído</strong>
          <small>Esta versão não contém mais o documento.</small>
        </>
      ) : (
        <>
          <strong>{document.title}</strong>
          <small>
            {version ? `Versão ${version} · ` : ""}
            {document.pages.length} página(s) · {elementCount} elemento(s)
          </small>
          <time dateTime={document.updatedAt}>
            Editado em {formatDate(document.updatedAt)}
          </time>
        </>
      )}
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "data desconhecida"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function readableApiError(error: string): string {
  try {
    const parsed = JSON.parse(error) as { message?: string | string[] };
    return Array.isArray(parsed.message)
      ? parsed.message.join(" ")
      : (parsed.message ?? error);
  } catch {
    return error;
  }
}
