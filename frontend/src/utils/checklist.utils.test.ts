import { describe, expect, it } from "vitest";
import {
  checklistToText,
  moveChecklistItem,
  textToChecklistContent,
} from "./checklist.utils";

describe("checklist utils", () => {
  it("converte texto e preserva marcações markdown", () => {
    const checklist = textToChecklistContent({
      kind: "text",
      text: "- [x] Comprar flores\n- [ ] Regar plantas\nAnotar ideias",
    });

    expect(checklist.items).toMatchObject([
      { text: "Comprar flores", completed: true },
      { text: "Regar plantas", completed: false },
      { text: "Anotar ideias", completed: false },
    ]);
    expect(checklistToText(checklist)).toContain("- [x] Comprar flores");
  });

  it("reordena itens sem alterar os demais dados", () => {
    const items = [
      { id: "a", text: "A", completed: false },
      { id: "b", text: "B", completed: true },
      { id: "c", text: "C", completed: false },
    ];
    expect(moveChecklistItem(items, "a", 2).map((item) => item.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});
