export type AssetDiagnosticEvent =
  | "preview-load-failed"
  | "preview-refresh-failed"
  | "preview-not-found";

interface AssetDiagnostic {
  event: AssetDiagnosticEvent;
  assetId?: string;
  source: "built-in" | "imported" | "remote" | "document-reference";
  status?: number;
}

export function reportAssetDiagnostic(diagnostic: AssetDiagnostic): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("moctes:asset-diagnostic", { detail: diagnostic }),
    );
  }
  if (import.meta.env.DEV) {
    console.warn("[Moctes assets]", diagnostic);
  }
}
