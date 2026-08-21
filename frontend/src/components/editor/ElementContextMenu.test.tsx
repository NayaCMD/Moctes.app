import { beforeEach, describe, expect, it, vi } from "vitest";
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
    useDocumentStore.getState().selectElement(element.id);
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
    useDocumentStore.getState().selectElement(element.id);
    useEditorStore.getState().openContextMenu(element.id, 20, 20);

    render(<ElementContextMenu />);

    expect(screen.getByRole("menuitem", { name: /Duplicar/ })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /Excluir/ })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /Copiar/ })).toBeEnabled();
  });

  it("isola os eventos do menu e não os propaga para o editor", async () => {
    openNotebook();
    const element = useDocumentStore.getState().documents[0].pages[0].elements[0];
    const handlePointerDown = vi.fn();
    const handleClick = vi.fn();
    useDocumentStore.getState().selectElement(element.id);
    useEditorStore.getState().openContextMenu(element.id, 20, 20);

    render(
      <div onPointerDown={handlePointerDown} onClick={handleClick}>
        <ElementContextMenu />
      </div>,
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Copiar/ }));

    expect(handlePointerDown).not.toHaveBeenCalled();
    expect(handleClick).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().selectedElementId).toBe(element.id);
  });

  it("fecha o menu quando a seleção muda", () => {
    openNotebook();
    const elements = useDocumentStore.getState().documents[0].pages[0].elements;
    useDocumentStore.getState().selectElement(elements[0].id);
    useEditorStore.getState().openContextMenu(elements[0].id, 20, 20);
    const view = render(<ElementContextMenu />);

    useDocumentStore.getState().selectElement(elements[1].id);
    view.rerender(<ElementContextMenu />);

    expect(useEditorStore.getState().contextMenu.open).toBe(false);
    expect(screen.queryByRole("menu", { name: "Menu do elemento" })).not.toBeInTheDocument();
  });
});
