import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { resetStores } from "../../test/helpers/resetStores";
import type { PageElement } from "../../types/element.types";
import { CommentElement } from "./CommentElement";

const commentElement: PageElement = {
  id: "comment-1",
  type: "comment",
  x: 20,
  y: 20,
  width: 6,
  height: 6,
  rotation: 0,
  zIndex: 1,
  locked: false,
  hidden: false,
  content: {
    kind: "comment",
    color: "#8da3ed",
    resolved: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    messages: [
      {
        id: "msg-1",
        authorLabel: "Usuária",
        text: "Oi",
        createdAt: "2026-01-01T00:00:00.000Z",
        attachments: [],
      },
    ],
  },
  style: {},
};

describe("CommentElement", () => {
  beforeEach(() => resetStores());

  it("mantem marcador no documento e abre thread em portal", async () => {
    const { container } = render(<CommentElement element={commentElement} />);
    const marker = screen.getByRole("button", { name: "Abrir comentário" });

    await userEvent.click(marker);

    const thread = screen.getByText("Comentário").closest("form");
    expect(thread).toBeInTheDocument();
    expect(container).toContainElement(marker);
    expect(container).not.toContainElement(thread);
    expect(thread).toHaveStyle({ position: "fixed", zIndex: "300" });
  });

  it("fecha com Escape e devolve foco ao marcador", async () => {
    render(<CommentElement element={commentElement} />);
    const marker = screen.getByRole("button", { name: "Abrir comentário" });

    await userEvent.click(marker);
    expect(screen.getByText("Comentário")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByText("Comentário")).not.toBeInTheDocument();
    expect(marker).toHaveFocus();
  });
});
