import { describe, expect, it } from "vitest";
import type { ElementContent } from "../types/element.types";
import { normalizeTapeContent } from "./tape.utils";

describe("normalizeTapeContent", () => {
  it("migra tapes legadas para repetição e borda suave", () => {
    const legacy: ElementContent = {
      kind: "tape",
      assetId: "legacy-tape",
      src: "/legacy.png",
      alt: "Tape antiga",
    };

    expect(normalizeTapeContent(legacy)).toEqual({
      ...legacy,
      renderMode: "repeat",
      edgeStyle: "torn-soft",
    });
  });
});
