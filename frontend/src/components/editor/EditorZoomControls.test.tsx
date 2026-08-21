import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorZoomControls } from "./EditorZoomControls";

describe("EditorZoomControls", () => {
  it("continues zooming from the fitted scale", () => {
    const onZoomChange = vi.fn();
    const onResetZoom = vi.fn();

    render(
      <EditorZoomControls
        scale={1.5}
        zoom={1}
        zoomMode="fit"
        onZoomChange={onZoomChange}
        onFitToWindow={vi.fn()}
        onResetZoom={onResetZoom}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Diminuir zoom" }));
    fireEvent.click(screen.getByRole("button", { name: "Aumentar zoom" }));
    fireEvent.click(screen.getByRole("button", { name: /Zoom atual 150%/ }));

    expect(onZoomChange).toHaveBeenNthCalledWith(1, 1.4);
    expect(onZoomChange).toHaveBeenNthCalledWith(2, 1.6);
    expect(onResetZoom).toHaveBeenCalledOnce();
  });

  it("continues zooming from the manual zoom value", () => {
    const onZoomChange = vi.fn();

    render(
      <EditorZoomControls
        scale={1.2}
        zoom={1.2}
        zoomMode="manual"
        onZoomChange={onZoomChange}
        onFitToWindow={vi.fn()}
        onResetZoom={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aumentar zoom" }));

    expect(onZoomChange).toHaveBeenCalledWith(1.3);
  });
});
