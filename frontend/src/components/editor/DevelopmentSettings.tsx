import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";

export function DevelopmentSettings() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const restoreDemoDocuments = useDocumentStore((state) => state.restoreDemoDocuments);
  const resetEditorSession = useEditorStore((state) => state.resetEditorSession);

  return (
    <details className="development-settings">
      <summary>Opções de desenvolvimento</summary>
      <div>
        <p>Ferramentas locais para redefinir o conteúdo de demonstração.</p>
        <button type="button" onClick={() => setConfirmOpen(true)}>
          <RotateCcw size={14} aria-hidden="true" />
          Restaurar demonstração
        </button>
      </div>
      <ConfirmationDialog
        open={confirmOpen}
        title="Restaurar demonstração"
        description="As alterações locais dos documentos serão apagadas e a composição de demonstração será restaurada."
        confirmLabel="Restaurar"
        variant="warning"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          restoreDemoDocuments();
          resetEditorSession();
          setConfirmOpen(false);
        }}
      />
    </details>
  );
}
