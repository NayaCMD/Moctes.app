import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PageElement } from "../../types/element.types";
import { EmojiElement } from "./EmojiElement";

function createEmojiElement(): PageElement {
  return {
    id: "emoji-1",
    type: "emoji",
    x: 20,
    y: 20,
    width: 8,
    height: 8,
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    content: { kind: "emoji", emoji: "💙" },
    style: {},
  };
}

describe("EmojiElement", () => {
  it("dimensiona o emoji pelo menor eixo do conteiner", async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 120,
      bottom: 60,
      width: 120,
      height: 60,
      toJSON: () => ({}),
    } as DOMRect);

    render(<EmojiElement element={createEmojiElement()} />);

    await waitFor(() => expect(screen.getByText("💙")).toHaveStyle({ fontSize: "49px" }));
    rectSpy.mockRestore();
  });
});
