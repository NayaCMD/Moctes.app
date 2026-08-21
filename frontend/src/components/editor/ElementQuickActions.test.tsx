import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import type { PageElement } from "../../types/element.types";
import { ElementQuickActions } from "./ElementQuickActions";
import {
  calculateContextMenuOrigin,
  calculateQuickActionsPosition,
} from "./elementQuickActions.position";

function getTestPage() {
  return useDocumentStore.getState().documents[0].pages[0];
}

function getElement(elementId: string): PageElement {
  const element = getTestPage().elements.find((candidate) => candidate.id === elementId);
  if (!element) throw new Error(`Elemento ${elementId} não encontrado`);
  return element;
}

function createPageElement() {
  const pageElement = document.createElement("section");
  pageElement.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 500,
      bottom: 700,
      width: 500,
      height: 700,
      toJSON: () => undefined,
    }) as DOMRect;
  return pageElement;
}

describe("ElementQuickActions", () => {
  beforeEach(() => resetStores());

  it("move o elemento uma camada para baixo e para cima", async () => {
    const page = getTestPage();
    const ordered = [...page.elements].sort((first, second) => first.zIndex - second.zIndex);
    const element = ordered[1];
    const view = render(
      <ElementQuickActions
        element={element}
        elements={page.elements}
        pageElement={createPageElement()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Elevar uma camada" }));
    expect(getElement(element.id).zIndex).toBe(3);

    const updatedPage = getTestPage();
    view.rerender(
      <ElementQuickActions
        element={getElement(element.id)}
        elements={updatedPage.elements}
        pageElement={createPageElement()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Baixar uma camada" }));
    expect(getElement(element.id).zIndex).toBe(2);
  });

  it("duplica, bloqueia e oferece o menu completo", async () => {
    const page = getTestPage();
    const element = page.elements[0];
    const initialCount = page.elements.length;
    render(
      <ElementQuickActions
        element={element}
        elements={page.elements}
        pageElement={createPageElement()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Duplicar elemento" }));
    expect(getTestPage().elements).toHaveLength(initialCount + 1);

    await userEvent.click(screen.getByRole("button", { name: "Bloquear elemento" }));
    expect(getElement(element.id).locked).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Mais ações do elemento" }));
    expect(useEditorStore.getState().contextMenu).toMatchObject({
      open: true,
      elementId: element.id,
    });
  });

  it("desabilita comandos de camada nos limites da pilha", () => {
    const page = getTestPage();
    const ordered = [...page.elements].sort((first, second) => first.zIndex - second.zIndex);
    const element = ordered.at(-1)!;
    render(
      <ElementQuickActions
        element={element}
        elements={page.elements}
        pageElement={createPageElement()}
      />,
    );

    expect(screen.getByRole("button", { name: "Elevar uma camada" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Baixar uma camada" })).toBeEnabled();
  });

  it("reposiciona a barra acima quando o elemento está próximo do rodapé", () => {
    const position = calculateQuickActionsPosition(
      { left: 960, top: 610, width: 120, height: 70 },
      { width: 300, height: 44 },
      { left: 8, top: 72, right: 1272, bottom: 700 },
    );

    expect(position.top).toBe(554);
    expect(position.top + 44).toBeLessThan(610);
    expect(position.left).toBeGreaterThanOrEqual(8);
    expect(position.left + 300).toBeLessThanOrEqual(1272);
  });

  it("reposiciona a barra abaixo quando não há espaço acima", () => {
    const position = calculateQuickActionsPosition(
      { left: 280, top: 78, width: 80, height: 40 },
      { width: 260, height: 44 },
      { left: 8, top: 72, right: 1272, bottom: 700 },
    );

    expect(position.top).toBe(130);
  });

  it("isola pointer e click para não selecionar conteúdo atrás da barra", async () => {
    const page = getTestPage();
    const element = page.elements[1];
    const handlePointerDown = vi.fn();
    const handleClick = vi.fn();
    render(
      <div onPointerDown={handlePointerDown} onClick={handleClick}>
        <ElementQuickActions
          element={element}
          elements={page.elements}
          pageElement={createPageElement()}
        />
      </div>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Elevar uma camada" }));

    expect(handlePointerDown).not.toHaveBeenCalled();
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("abre o menu ao lado sem cobrir a barra de ações", () => {
    const onRight = calculateContextMenuOrigin(
      { left: 400, top: 300, width: 286, height: 44 },
      { width: 1280, height: 720 },
    );
    expect(onRight.left).toBe(694);

    const onLeft = calculateContextMenuOrigin(
      { left: 980, top: 300, width: 286, height: 44 },
      { width: 1280, height: 720 },
    );
    expect(onLeft.left + 224).toBeLessThan(980);
  });
});
