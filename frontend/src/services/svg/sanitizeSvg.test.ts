import { describe, expect, it } from "vitest";
import { sanitizeSvgText } from "./sanitizeSvg";

describe("sanitizeSvgText", () => {
  it("aceita SVG simples e serializa o conteudo seguro", () => {
    const result = sanitizeSvgText('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("<circle");
      expect(result.text).not.toContain("<script");
    }
  });

  it("rejeita scripts, eventos inline e links externos", () => {
    expect(sanitizeSvgText('<svg><script>alert(1)</script></svg>').ok).toBe(false);
    expect(sanitizeSvgText('<svg><circle onload="alert(1)" /></svg>').ok).toBe(false);
    expect(sanitizeSvgText('<svg><image href="https://example.com/x.png" /></svg>').ok).toBe(false);
  });
});
