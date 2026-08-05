export interface SanitizedSvgResult {
  ok: true;
  text: string;
}

export interface InvalidSvgResult {
  ok: false;
  message: string;
}

const forbiddenElements = new Set(["script", "foreignobject", "iframe", "object", "embed"]);
const forbiddenAttributePrefixes = ["on"];
const forbiddenUrlPatterns = [/javascript:/i, /url\(\s*https?:/i, /href\s*=\s*["']https?:/i];

export function sanitizeSvgText(svgText: string): SanitizedSvgResult | InvalidSvgResult {
  if (svgText.length === 0 || svgText.length > 512 * 1024) {
    return { ok: false, message: "SVG vazio ou muito grande." };
  }
  if (forbiddenUrlPatterns.some((pattern) => pattern.test(svgText))) {
    return { ok: false, message: "SVG com referência externa ou insegura." };
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, "image/svg+xml");
  if (document.querySelector("parsererror")) {
    return { ok: false, message: "SVG inválido." };
  }
  const svg = document.documentElement;
  if (svg.tagName.toLowerCase() !== "svg") {
    return { ok: false, message: "O arquivo precisa conter um SVG." };
  }

  for (const element of Array.from(svg.querySelectorAll("*"))) {
    if (forbiddenElements.has(element.tagName.toLowerCase())) {
      return { ok: false, message: "SVG contém elemento não permitido." };
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (forbiddenAttributePrefixes.some((prefix) => name.startsWith(prefix))) {
        return { ok: false, message: "SVG contém evento não permitido." };
      }
      if (/javascript:/i.test(value) || /https?:/i.test(value)) {
        return { ok: false, message: "SVG contém link externo não permitido." };
      }
    }
  }

  return { ok: true, text: new XMLSerializer().serializeToString(svg) };
}
