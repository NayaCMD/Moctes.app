import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import { ElementContextMenu } from "./ElementContextMenu";

describe("ElementContextMenu", () => {
  beforeEach(() => resetStores());

  function openNotebook() {
    useEditorStore.setState({
      notebookBook: { documentId: useDocumentStore.getState().documents[0].id, phase: "open" },
    });
  }

  it("abre, copia, duplica e fecha", async () => {
    openNotebook();
    const element = useDocumentStore.getState().documents[0].pages[0].elements[0];
    useEditorStore.getState().openContextMenu(element.id, 20, 20);
    const view = render(<ElementContextMenu />);

    expect(screen.getByRole("menu", { name: "Menu do elemento" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: /Copiar/ }));
    expect(useEditorStore.getState().clipboardElement?.id).toBe(element.id);

    useEditorStore.getState().openContextMenu(element.id, 20, 20);
    view.rerender(<ElementContextMenu />);
    await userEvent.click(screen.getByRole("menuitem", { name: /Duplicar/ }));
    expect(useDocumentStore.getState().documents[0].pages[0].elements.length).toBeGreaterThan(7);
  });

  it("desabilita ações destrutivas quando elemento está bloqueado", () => {
    openNotebook();
    const element = useDocumentStore.getState().documents[0].pages[0].elements[0];
    useDocumentStore.getState().toggleElementLock(element.id);
    useEditorStore.getState().openContextMenu(element.id, 20, 20);

    render(<ElementContextMenu />);

    expect(screen.getByRole("menuitem", { name: /Duplicar/ })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /Excluir/ })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /Copiar/ })).toBeEnabled();
  });
});
