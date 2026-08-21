import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
import type { PageElement } from "../../types/element.types";
import { resetStores } from "../../test/helpers/resetStores";
import { ImageElement } from "./ImageElement";

describe("ImageElement asset states", () => {
  beforeEach(() => resetStores());

  it("keeps the editor element box and renders PROCESSING as progress", () => {
    useAssetLibraryStore.setState((state) => ({
      assets: [
        ...state.assets,
        {
          id: "processing-image",
          workspaceId: "workspace-1",
          folderId: "folder-default-assets",
          type: "image",
          name: "Processing",
          src: "",
          mimeType: "image/png",
          size: 10,
          source: "remote",
          status: "PROCESSING",
          createdAt: "2026-08-17T00:00:00.000Z",
          updatedAt: "2026-08-17T00:00:00.000Z",
        },
      ],
    }));
    const element = imageElement();

    render(<ImageElement element={element} />);

    const placeholder = screen.getByRole("status", {
      name: /Processando imagem/i,
    });
    expect(placeholder).toHaveStyle({ borderRadius: "12px" });
    expect(element).toMatchObject({
      x: 12,
      y: 18,
      width: 32,
      height: 28,
      rotation: 7,
      zIndex: 4,
    });
  });
});

function imageElement(): PageElement {
  return {
    id: "image-element",
    type: "image",
    x: 12,
    y: 18,
    width: 32,
    height: 28,
    rotation: 7,
    zIndex: 4,
    locked: false,
    hidden: false,
    content: {
      kind: "image",
      assetId: "processing-image",
      src: "asset://processing-image",
      alt: "Processing image",
    },
    style: { image: { borderRadius: 12, objectFit: "cover" } },
  };
}
