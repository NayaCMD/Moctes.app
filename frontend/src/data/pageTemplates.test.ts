import { describe, expect, it } from "vitest";
import { PAGE_TEMPLATES, instantiatePageTemplate } from "./pageTemplates";
import { DEFAULT_PAPER_APPEARANCE } from "../utils/paperAppearance.utils";

describe("pageTemplates", () => {
  it("oferece todos os templates planejados com IDs únicos", () => {
    expect(PAGE_TEMPLATES.map((template) => template.id)).toEqual([
      "diary",
      "daily-planner",
      "studies",
      "moodboard",
      "checklist",
      "weekly",
      "monthly",
      "project",
      "blank",
    ]);
    expect(new Set(PAGE_TEMPLATES.map((template) => template.id)).size).toBe(PAGE_TEMPLATES.length);
  });

  it.each(PAGE_TEMPLATES.map((template) => template.id))(
    "instancia %s com elementos e IDs independentes",
    (templateId) => {
      const first = instantiatePageTemplate(templateId, DEFAULT_PAPER_APPEARANCE);
      const second = instantiatePageTemplate(templateId, DEFAULT_PAPER_APPEARANCE);

      expect(first.title).toBeTruthy();
      expect(first.appearance.paperColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(new Set(first.elements.map((element) => element.id)).size).toBe(first.elements.length);
      for (const element of first.elements) {
        expect(element.x).toBeGreaterThanOrEqual(0);
        expect(element.y).toBeGreaterThanOrEqual(0);
        expect(element.x + element.width).toBeLessThanOrEqual(100);
        expect(element.y + element.height).toBeLessThanOrEqual(100);
      }
      if (templateId === "blank") {
        expect(first.elements).toHaveLength(0);
      } else {
        expect(first.elements.map((element) => element.id)).not.toEqual(
          second.elements.map((element) => element.id),
        );
        expect(first.elements.length).toBeGreaterThan(0);
      }
    },
  );

  it("usa checklist real nos templates de produtividade", () => {
    for (const templateId of ["daily-planner", "studies", "checklist", "project"] as const) {
      expect(
        instantiatePageTemplate(templateId, DEFAULT_PAPER_APPEARANCE).elements.some(
          (element) => element.type === "checklist" && element.content.kind === "checklist",
        ),
      ).toBe(true);
    }
  });
});
