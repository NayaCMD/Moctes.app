import { useEffect, useState } from "react";
import {
  getDocumentRevision,
  listDocumentRevisions,
  type DocumentRevision,
  type DocumentRevisionList,
  type DocumentRevisionSummary,
} from "../../services/documentRevisions";
import { restoreDocumentRevision } from "../../services/documentPersistence";
import { DocumentPage } from "../documents/DocumentPage";

interface RevisionLoadState {
  key: string;
  data: DocumentRevisionList | null;
  error: string | null;
}

export function DocumentRevisionHistory({
  documentId,
  canRestore,
  onClose,
}: {
  documentId: string;
  canRestore: boolean;
  onClose: () => void;
}) {
  const [reload, setReload] = useState(0);
  const [loadState, setLoadState] = useState<RevisionLoadState | null>(null);
  const [pendingRevision, setPendingRevision] =
    useState<DocumentRevisionSummary | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentRevision | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const requestKey = `${documentId}:${reload}`;

  useEffect(() => {
    let active = true;
    void listDocumentRevisions(documentId).then((response) => {
      if (!active) {
        return;
      }
      setLoadState({
        key: requestKey,
        data: response.ok ? response.data : null,
        error: response.ok ? null : readableApiError(response.error),
      });
    });
    return () => {
      active = false;
    };
  }, [documentId, requestKey]);

  const currentLoad = loadState?.key === requestKey ? loadState : null;
  const history = currentLoad?.data ?? null;

  const confirmRestore = async () => {
    if (!pendingRevision || !history) {
      return;
    }
    setRestoring(true);
    setRestoreError(null);
    const response = await restoreDocumentRevision(
      documentId,
      pendingRevision.version,
      history.currentVersion,
    );
    setRestoring(false);
    if (!response.ok) {
      setRestoreError(readableApiError(response.error));
      return;
    }
    setPendingRevision(null);
    setReload((value) => value + 1);
  };

  const loadPreview = async (revision: DocumentRevisionSummary) => {
    setPreviewLoading(true);
    setRestoreError(null);
    const response = await getDocumentRevision(documentId, revision.version);
    setPreviewLoading(false);
    if (!response.ok) {
      setRestoreError(readableApiError(response.error));
      return;
    }
    setPreview(response.data);
  };

  return (
    <div className="sync-modal-backdrop">
      <section
        aria-labelledby="revision-history-title"
        aria-modal="true"
        className="sync-modal revision-history-dialog"
        role="dialog"
      >
        <header className="revision-history-header">
          <div>
            <span>Documento atual</span>
            <h2 id="revision-history-title">Histórico de versões</h2>
          </div>
          <button aria-label="Fechar histórico" type="button" onClick={onClose}>
            ×
          </button>
        </header>

        {!currentLoad && <p className="sync-modal-state">Carregando histórico…</p>}
        {currentLoad?.error && (
          <p className="sync-modal-error" role="alert">
            {currentLoad.error}
          </p>
        )}
        {history && (
          <div className="revision-list">
            {history.revisions.map((revision) => (
              <article key={revision.id}>
                <div>
                  <strong>Versão {revision.version}</strong>
                  {revision.version === history.currentVersion && (
                    <span className="revision-current-badge">Atual</span>
                  )}
                  {revision.restoredFromVersion && (
                    <span>Restaurada da v{revision.restoredFromVersion}</span>
                  )}
                </div>
                <p>{revision.title}</p>
                <small>
                  {formatDate(revision.createdAt)} · {revision.createdBy?.name ?? "Migração"}
                </small>
                <div className="revision-actions">
                  <button type="button" onClick={() => void loadPreview(revision)}>
                    Ver detalhes
                  </button>
                  {canRestore && revision.version !== history.currentVersion && (
                    <button type="button" onClick={() => setPendingRevision(revision)}>
                      Restaurar esta versão
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {!canRestore && history && (
          <p className="revision-readonly-note">
            Seu papel permite consultar o histórico, mas não restaurar versões.
          </p>
        )}

        {preview && (
          <section className="revision-preview" aria-label={`Detalhes da versão ${preview.version}`}>
            <header>
              <div>
                <span>Prévia recuperável</span>
                <strong>Versão {preview.version} · {preview.document.title}</strong>
              </div>
              <button type="button" onClick={() => setPreview(null)}>Fechar prévia</button>
            </header>
            <div className="revision-preview-summary">
              <span>{preview.document.pages.length} páginas</span>
              <span>{preview.document.sections?.length ?? 0} seções</span>
              <span>{preview.document.pages.reduce((total, page) => total + page.elements.length, 0)} elementos</span>
            </div>
            {preview.document.pages[0] && (
              <div className="revision-preview-canvas">
                <DocumentPage
                  page={preview.document.pages[0]}
                  className="revision-preview-paper"
                  label={`Prévia da versão ${preview.version}`}
                  interactive={false}
                />
              </div>
            )}
          </section>
        )}
        {previewLoading && <p className="sync-modal-state">Carregando prévia…</p>}

        {pendingRevision && history && (
          <div className="revision-confirmation">
            <strong>Restaurar a versão {pendingRevision.version}?</strong>
            <p>
              A versão atual será preservada no histórico. Alterações locais ainda
              não sincronizadas deste documento serão descartadas.
            </p>
            {restoreError && <p className="sync-modal-error">{restoreError}</p>}
            <div>
              <button
                className="sync-secondary-action"
                disabled={restoring}
                type="button"
                onClick={() => setPendingRevision(null)}
              >
                Cancelar
              </button>
              <button
                className="sync-primary-action"
                disabled={restoring}
                type="button"
                onClick={() => void confirmRestore()}
              >
                {restoring ? "Restaurando…" : "Confirmar restauração"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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
