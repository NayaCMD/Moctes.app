import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { resetStores } from "../../test/helpers/resetStores";
import { PaperSettings } from "./PaperSettings";

describe("PaperSettings", () => {
  beforeEach(() => resetStores());

  it("aplica preset no documento e salva a aparência como template", async () => {
    const user = userEvent.setup();
    render(<PaperSettings />);

    await user.click(screen.getByRole("button", { name: "Documento" }));
    await user.click(screen.getByRole("button", { name: /Estúdio/ }));

    let state = useDocumentStore.getState();
    let document = state.documents.find((item) => item.id === state.activeDocumentId)!;
    expect(document.defaultPaperAppearance?.paperType).toBe("grid");
    expect(document.pages.every((page) => page.paperType === "grid")).toBe(true);

    await user.type(screen.getByLabelText("Nome do template"), "Meu grid");
    await user.click(screen.getByRole("button", { name: "Salvar aparência como template" }));

    state = useDocumentStore.getState();
    document = state.documents.find((item) => item.id === state.activeDocumentId)!;
    expect(document.paperTemplates).toEqual([
      expect.objectContaining({
        name: "Meu grid",
        appearance: expect.objectContaining({ paperType: "grid", paperTexture: "grain" }),
      }),
    ]);
    expect(screen.getByText(/Template “Meu grid” salvo/)).toBeVisible();
  });
});
