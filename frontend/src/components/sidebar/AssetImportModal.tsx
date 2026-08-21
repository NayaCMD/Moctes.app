import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle } from "lucide-react";
import {
  deleteWorkspaceAsset,
  uploadWorkspaceAsset,
} from "../../services/assetPersistence";
import { sanitizeSvgText } from "../../services/svg/sanitizeSvg";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
import { useAuthStore } from "../../stores/useAuthStore";
import type { AssetType } from "../../types/asset.types";
import {
  MAX_ASSET_FILE_SIZE,
  validateAssetFile,
} from "../../utils/assetLibrary.utils";

interface AssetImportModalProps {
  open: boolean;
  initialType?: AssetType;
  svgMode?: "shape" | "sticker";
  onClose: () => void;
}

const typeOptions: Array<{ value: AssetType; label: string }> = [
  { value: "image", label: "Imagem" },
  { value: "sticker", label: "Sticker" },
  { value: "post-it", label: "Post-it" },
  { value: "tape", label: "Tape" },
];

export function AssetImportModal({
  open,
  initialType,
  svgMode,
  onClose,
}: AssetImportModalProps) {
  const initialAssetType = initialType ?? "image";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folders = useAssetLibraryStore((state) => state.folders);
  const activeFolderId = useAssetLibraryStore((state) => state.activeFolderId);
  const addAsset = useAssetLibraryStore((state) => state.addAsset);
  const setSelectedAsset = useAssetLibraryStore(
    (state) => state.setSelectedAsset,
  );
  const setImportStatus = useAssetLibraryStore(
    (state) => state.setImportStatus,
  );
  const importStatus = useAssetLibraryStore((state) => state.importStatus);
  const setFeedbackMessage = useAssetLibraryStore(
    (state) => state.setFeedbackMessage,
  );
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const userId = useAuthStore((state) => state.user?.id);
  const [file, setFile] = useState<File | null>(null);
  const [sanitizedFile, setSanitizedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>(initialAssetType);
  const [svgImportMode, setSvgImportMode] = useState<"shape" | "sticker">(
    svgMode ?? "sticker",
  );
  const [folderId, setFolderId] = useState(activeFolderId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const resetForm = useCallback(() => {
    setFile(null);
    setSanitizedFile(null);
    setName("");
    setType(initialAssetType);
    setSvgImportMode(svgMode ?? "sticker");
    setFolderId(activeFolderId);
    setErrorMessage(null);
    setDimensions(null);
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [activeFolderId, initialAssetType, svgMode]);

  const closeAndReset = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  useEffect(() => {
    if (!open) {
      return;
    }
    window.setTimeout(() => fileInputRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndReset();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeAndReset, open]);

  useEffect(
    () => () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    },
    [],
  );

  const canImport = useMemo(
    () =>
      Boolean(
        (sanitizedFile ?? file) &&
          name.trim() &&
          folderId &&
          !errorMessage &&
          importStatus !== "importing" &&
          importStatus !== "validating",
      ),
    [errorMessage, file, folderId, importStatus, name, sanitizedFile],
  );
  const isUploading = importStatus === "importing";

  if (!open) {
    return null;
  }

  const handleFile = async (selectedFile: File | null) => {
    setImportStatus(selectedFile ? "validating" : "idle");
    setFile(null);
    setSanitizedFile(null);
    setDimensions(null);
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(null);
    if (!selectedFile) {
      setErrorMessage(null);
      return;
    }

    const validation = validateAssetFile(selectedFile);
    if (validation) {
      setErrorMessage(validation.message);
      setImportStatus("error", validation);
      return;
    }

    let fileForStorage = selectedFile;
    if (selectedFile.type === "image/svg+xml") {
      const sanitized = sanitizeSvgText(await selectedFile.text());
      if (sanitized.ok === false) {
        setErrorMessage(sanitized.message);
        setImportStatus("error", {
          code: "INVALID_FILE_TYPE",
          message: sanitized.message,
        });
        return;
      }
      fileForStorage = new File([sanitized.text], selectedFile.name, {
        type: "image/svg+xml",
      });
      setType("sticker");
      setSvgImportMode(svgMode ?? "sticker");
    }

    setFile(selectedFile);
    setSanitizedFile(fileForStorage);
    setName(selectedFile.name.replace(/\.[^.]+$/, ""));
    setErrorMessage(null);
    const url = URL.createObjectURL(fileForStorage);
    previewObjectUrlRef.current = url;
    setPreviewUrl(url);
    const image = new Image();
    image.onload = () => {
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => undefined;
    image.src = url;
    setImportStatus("idle");
  };

  const importAsset = async () => {
    const fileForStorage = sanitizedFile ?? file;
    if (!fileForStorage || !canImport) {
      return;
    }

    setImportStatus("importing");
    if (!activeWorkspaceId) {
      const workspaceError = {
        code: "STORAGE_ERROR" as const,
        message: "Nenhum espaço ativo para receber o arquivo.",
      };
      setErrorMessage(workspaceError.message);
      setImportStatus("error", workspaceError);
      return;
    }

    const uploaded = await uploadWorkspaceAsset({
      workspaceId: activeWorkspaceId,
      folderId,
      type,
      name:
        fileForStorage.type === "image/svg+xml" && svgImportMode === "shape"
          ? `${name.trim()} (forma SVG)`
          : name.trim(),
      file: fileForStorage,
      width: dimensions?.width,
      height: dimensions?.height,
      cacheScope:
        userId && activeWorkspaceId
          ? `${userId}:${activeWorkspaceId}`
          : undefined,
    });
    if (!uploaded.ok) {
      const storageError = {
        code: "STORAGE_ERROR" as const,
        message: readableApiError(uploaded.error),
      };
      setErrorMessage(storageError.message);
      setImportStatus("error", storageError);
      return;
    }

    const result = addAsset(uploaded.data);
    if (result.ok === false) {
      await deleteWorkspaceAsset(
        uploaded.data.id,
        userId && activeWorkspaceId
          ? `${userId}:${activeWorkspaceId}`
          : undefined,
      );
      setErrorMessage(result.error.message);
      setImportStatus("error", result.error);
      return;
    }

    setSelectedAsset(uploaded.data.id);
    setFeedbackMessage(
      uploaded.data.status === "READY"
        ? "Asset importado."
        : "Upload concluído. A imagem está sendo processada.",
    );
    closeAndReset();
  };

  return createPortal(
    <div
      className="asset-modal-backdrop"
      role="presentation"
      onMouseDown={isUploading ? undefined : closeAndReset}
    >
      <form
        className="asset-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-import-title"
        aria-busy={isUploading}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          void importAsset();
        }}
      >
        <header>
          <div>
            <h2 id="asset-import-title">
              {initialType === "image"
                ? "Importar imagem"
                : initialType === "tape"
                  ? "Importar tape"
                  : initialType === "sticker" && svgMode
                    ? "Importar SVG"
                    : "Importar asset"}
            </h2>
            <p>Escolha um arquivo leve para adicionar à sua biblioteca.</p>
          </div>
          <button
            type="button"
            aria-label="Fechar importação"
            disabled={isUploading}
            onClick={closeAndReset}
          >
            Fechar
          </button>
        </header>

        <label className="asset-file-picker">
          Arquivo
          <input
            ref={fileInputRef}
            type="file"
            disabled={isUploading}
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            onChange={(event) =>
              void handleFile(event.target.files?.[0] ?? null)
            }
          />
          <span>{file ? file.name : "Nenhum arquivo selecionado"}</span>
          <strong>Escolher imagem</strong>
          {errorMessage && (
            <span className="asset-field-error">{errorMessage}</span>
          )}
        </label>

        {file?.type === "image/svg+xml" && (
          <fieldset className="asset-svg-mode-field">
            <legend>Importar como</legend>
            <div className="segmented-values">
              <button
                type="button"
                data-active={svgImportMode === "shape"}
                aria-pressed={svgImportMode === "shape"}
                onClick={() => setSvgImportMode("shape")}
              >
                Forma
              </button>
              <button
                type="button"
                data-active={svgImportMode === "sticker"}
                aria-pressed={svgImportMode === "sticker"}
                onClick={() => setSvgImportMode("sticker")}
              >
                Sticker
              </button>
            </div>
            <p>
              {svgImportMode === "shape"
                ? "Formas SVG personalizadas são monocromáticas nesta versão."
                : "Stickers SVG preservam as cores originais."}
            </p>
          </fieldset>
        )}

        <label>
          Nome
          <input
            value={name}
            disabled={isUploading}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label>
          Tipo
          <select
            value={type}
            disabled={isUploading}
            onChange={(event) => setType(event.target.value as AssetType)}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Pasta
          <select
            value={folderId}
            disabled={isUploading}
            onChange={(event) => setFolderId(event.target.value)}
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>

        <div className="asset-import-preview">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview do asset" />
          ) : (
            <span>Escolha um arquivo</span>
          )}
          {isUploading && (
            <span
              className="asset-upload-progress"
              role="status"
              aria-label="Enviando imagem"
            >
              <LoaderCircle size={18} aria-hidden="true" />
              Enviando imagem…
            </span>
          )}
        </div>
        <p className="asset-import-meta">
          {file
            ? `${file.type} - ${Math.round(file.size / 1024)} KB`
            : `Limite: ${MAX_ASSET_FILE_SIZE / 1024 / 1024} MB`}
          {dimensions ? ` - ${dimensions.width}x${dimensions.height}px` : ""}
        </p>
        <footer>
          <button type="button" disabled={isUploading} onClick={closeAndReset}>
            Cancelar
          </button>
          <button type="submit" disabled={!canImport}>
            {isUploading ? "Enviando…" : "Importar"}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
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
