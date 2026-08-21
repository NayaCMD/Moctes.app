import {
  AlertTriangle,
  Check,
  Clock3,
  CloudOff,
  LoaderCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { retryDocumentPersistence } from "../../services/documentPersistence";
import { useDocumentSyncStore } from "../../stores/useDocumentSyncStore";

export function DocumentSyncStatus() {
  const phase = useDocumentSyncStore((state) => state.phase);
  const pendingOperations = useDocumentSyncStore((state) => state.pendingOperations);
  const status = syncStatus(phase, pendingOperations);
  const Icon = status.icon;
  const canRetry = ["waiting-retry", "offline", "error"].includes(phase);

  return (
    <span
      className="document-sync-status"
      data-phase={phase}
      role="status"
      aria-label={status.longLabel}
      title={status.longLabel}
    >
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
      <span>{status.label}</span>
      {pendingOperations > 0 && (
        <span className="document-sync-count" aria-label={`${pendingOperations} pendente(s)`}>
          {pendingOperations}
        </span>
      )}
      {canRetry && (
        <button
          type="button"
          aria-label="Tentar sincronizar agora"
          data-tooltip="Tentar agora"
          onClick={() => void retryDocumentPersistence()}
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

function syncStatus(
  phase: string,
  pendingOperations: number,
): { label: string; longLabel: string; icon: LucideIcon } {
  switch (phase) {
    case "bootstrapping":
      return { label: "Conectando", longLabel: "Conectando ao servidor", icon: LoaderCircle };
    case "queued":
      return { label: "Na fila", longLabel: `${pendingOperations} alteração(ões) na fila`, icon: Clock3 };
    case "syncing":
      return { label: "Salvando", longLabel: "Salvando alterações", icon: LoaderCircle };
    case "synced":
      return { label: "Salvo", longLabel: "Todas as alterações foram salvas", icon: Check };
    case "waiting-retry":
      return {
        label: "Salvo localmente",
        longLabel:
          "Alterações seguras neste dispositivo; aguardando conexão com o servidor",
        icon: CloudOff,
      };
    case "offline":
      return { label: "Offline", longLabel: "Sem conexão; alterações preservadas neste dispositivo", icon: CloudOff };
    case "conflict":
      return { label: "Conflito", longLabel: "Existe um conflito de versão para resolver", icon: AlertTriangle };
    case "error":
      return { label: "Falha", longLabel: "Falha na sincronização", icon: AlertTriangle };
    default:
      return { label: "Local", longLabel: "Documento disponível localmente", icon: Check };
  }
}
