import { sanitizeSvgText } from "./sanitizeSvg";

export interface ValidSvgResult {
  ok: true;
}

export interface InvalidSvgValidationResult {
  ok: false;
  message: string;
}

export function validateSvgText(svgText: string): ValidSvgResult | InvalidSvgValidationResult {
  const result = sanitizeSvgText(svgText);
  return result.ok ? { ok: true } : result;
}
