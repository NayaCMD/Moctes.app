import { describe, expect, it } from "vitest";
import type { PageElement } from "../types/element.types";
import { createEmptyDocument } from "./document.utils";
import {
  applyHistoryPatches,
  createHistoryEntry,
  createPatches,
} from "./history.utils";

function textElement(id: string): PageElement {
  return {
    id,
    type: "text",
    x: 10,
    y: 20,
    width: 30,
    height: 10,
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    content: { kind: "text", text: "Teste" },
    style: {},
  };
}

describe("incremental history patches", () => {
  it("stores only the changed field and applies undo/redo", () => {
    const document = createEmptyDocument("notepad");
    const element = textElement("element-history");
    const before = [{
      ...document,
      pages: [{ ...document.pages[0], elements: [element] }],
    }];
    const after = [{
      ...before[0],
      pages: [{
        ...before[0].pages[0],
        elements: [{ ...element, x: 42 }],
      }],
    }];

    const entry = createHistoryEntry(before, after, "element/update");

    expect(entry).not.toBeNull();
    expect(entry?.patches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "set", value: 42 }),
      ]),
    );
    expect(JSON.stringify(entry).length).toBeLessThan(JSON.stringify(before).length);
    expect(applyHistoryPatches(before, entry!.patches)).toEqual(after);
    expect(applyHistoryPatches(after, entry!.inversePatches)).toEqual(before);
  });

  it("inserts and removes entities by stable id", () => {
    const document = createEmptyDocument("notepad");
    const before = [document];
    const after = [{
      ...document,
      pages: [{
        ...document.pages[0],
        elements: [textElement("element-added")],
      }],
    }];

    const patches = createPatches(before, after);

    expect(patches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "insert-entity", value: expect.objectContaining({ id: "element-added" }) }),
      ]),
    );
    expect(applyHistoryPatches(before, patches)).toEqual(after);
  });
});
