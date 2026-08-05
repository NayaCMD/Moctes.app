import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import { DrawingPreviewOverlay } from "./DrawingPreviewOverlay";

describe("DrawingPreviewOverlay", () => {
  beforeEach(() => resetStores());

  it("renderiza preview do traco em andamento da pagina ativa", () => {
    useEditorStore.getState().setDrawingPreview({
      pageId: "page-1",
      color: "#123456",
      width: 3,
      opacity: 0.5,
      guided: false,
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 25 },
      ],
    });

    const { container } = render(<DrawingPreviewOverlay pageId="page-1" />);
    const polyline = container.querySelector("polyline");

    expect(polyline).toBeInTheDocument();
    expect(polyline).toHaveAttribute("points", "10,10 20,25");
    expect(polyline).toHaveAttribute("stroke", "#123456");
  });

  it("nao renderiza preview de outra pagina", () => {
    useEditorStore.getState().setDrawingPreview({
      pageId: "page-1",
      color: "#123456",
      width: 3,
      opacity: 0.5,
      guided: false,
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 25 },
      ],
    });

    render(<DrawingPreviewOverlay pageId="page-2" />);

    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument();
  });
});
