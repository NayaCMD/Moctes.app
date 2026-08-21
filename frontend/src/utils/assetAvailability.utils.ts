import type {
  AssetAvailability,
  AssetProcessingStatus,
} from "../types/asset.types";

export interface AssetAvailabilityCopy {
  title: string;
  detail?: string;
  tone: "neutral" | "progress" | "warning" | "danger";
}

export function availabilityFromProcessingStatus(
  status: AssetProcessingStatus | undefined,
): AssetAvailability | null {
  switch (status) {
    case "PENDING":
      return "pending";
    case "PROCESSING":
      return "processing";
    case "QUARANTINED":
      return "quarantined";
    case "REJECTED":
      return "rejected";
    case "READY":
    case undefined:
      return null;
  }
}

export function assetAvailabilityCopy(
  availability: Exclude<AssetAvailability, "ready">,
  processingError?: { code: string; message: string },
): AssetAvailabilityCopy {
  switch (availability) {
    case "loading":
      return {
        title: "Carregando imagem",
        detail: "Buscando a melhor versão disponível.",
        tone: "progress",
      };
    case "pending":
      return {
        title: "Aguardando envio",
        detail: "O upload ainda não foi concluído.",
        tone: "progress",
      };
    case "processing":
      return {
        title: "Processando imagem",
        detail: "Preparando uma versão segura e otimizada.",
        tone: "progress",
      };
    case "quarantined":
      return {
        title: "Este arquivo não pôde ser utilizado",
        detail: safeProcessingReason(processingError, true),
        tone: "warning",
      };
    case "rejected":
      return {
        title: "Arquivo não permitido",
        detail: safeProcessingReason(processingError, false),
        tone: "danger",
      };
    case "offline":
      return {
        title: "Imagem não disponível offline",
        detail: "Ela será recuperada quando a conexão voltar.",
        tone: "neutral",
      };
    case "error":
      return {
        title: "Não foi possível carregar esta imagem",
        detail: "A falha pode ser temporária. Tente novamente.",
        tone: "danger",
      };
    case "not-found":
      return {
        title: "Arquivo não está mais disponível",
        detail: "A referência foi preservada neste documento.",
        tone: "neutral",
      };
  }
}

function safeProcessingReason(
  error: { code: string; message: string } | undefined,
  quarantined: boolean,
): string {
  switch (error?.code) {
    case "SOURCE_SIZE_MISMATCH":
    case "UPLOAD_METADATA_MISMATCH":
      return "O arquivo enviado está incompleto ou corrompido.";
    case "SOURCE_TYPE_MISMATCH":
      return "O conteúdo não corresponde ao formato informado.";
    case "UNSAFE_SVG":
      return "O SVG contém recursos que não são permitidos.";
    case "UNSAFE_IMAGE_DIMENSIONS":
      return "As dimensões da imagem excedem os limites permitidos.";
    case "IMAGE_DECODE_FAILED":
    case "IMAGE_CONVERSION_FAILED":
      return "Não foi possível interpretar o conteúdo da imagem.";
    case "PROCESSED_ASSET_QUOTA_EXCEEDED":
      return "Não há espaço suficiente para processar este arquivo.";
    default:
      return quarantined
        ? "O arquivo não passou pelas verificações de segurança."
        : "O arquivo não atende aos requisitos de imagem do Moctes.";
  }
}
