interface EraserOptionsProps {
  onEraseMode: () => void;
  onEraseAreaMode: () => void;
  onClearPage: () => void;
  onDeletePage: () => void;
}

export function EraserOptions({ onEraseMode, onEraseAreaMode, onClearPage, onDeletePage }: EraserOptionsProps) {
  return (
    <div className="erase-menu" role="menu" aria-label="Opcoes de apagar">
      <button type="button" role="menuitem" onClick={onEraseMode}>
        Apagar por clique
      </button>
      <button type="button" role="menuitem" onClick={onEraseAreaMode}>
        Apagar por area
      </button>
      <button type="button" role="menuitem" onClick={onClearPage}>
        Limpar página
      </button>
      <button type="button" role="menuitem" onClick={onDeletePage}>
        Excluir página
      </button>
    </div>
  );
}
