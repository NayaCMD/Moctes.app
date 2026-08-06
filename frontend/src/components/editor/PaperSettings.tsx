import { useState, type ChangeEvent } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { Page } from "../../types/page.types";
import type { PaperType } from "../../types/theme.types";
import { getEditableActivePage } from "../../utils/document.utils";

const patterns: Array<{
  value: PaperType;
  label: string;
}> = [
    { value: "blank", label: "Lisa" },
    { value: "lined", label: "Pautada" },
    { value: "grid", label: "Quadriculada" },
    { value: "dotted", label: "Pontilhada" },
  ];

type PageAppearanceUpdate = Partial<
  Pick<
    Page,
    | "paperType"
    | "paperColor"
    | "patternColor"
    | "patternOpacity"
    | "patternSize"
  >
>;

export function PaperSettings() {
  const [applyToAllPages, setApplyToAllPages] =
    useState(false);

  const paperType = useAppStore(
    (state) => state.paperType,
  );

  const paperColor = useAppStore(
    (state) => state.paperColor,
  );

  const setPaperType = useAppStore(
    (state) => state.setPaperType,
  );

  const setPaperColor = useAppStore(
    (state) => state.setPaperColor,
  );

  const documents = useDocumentStore(
    (state) => state.documents,
  );

  const activeDocumentId = useDocumentStore(
    (state) => state.activeDocumentId,
  );

  const updatePage = useDocumentStore(
    (state) => state.updatePage,
  );

  const updateDocument = useDocumentStore(
    (state) => state.updateDocument,
  );

  const recordHistory = useEditorStore(
    (state) => state.recordHistory,
  );
  const notebookTransition = useEditorStore(
    (state) => state.notebookTransition,
  );

  const activeDocument = documents.find(
    (document) => document.id === activeDocumentId,
  );

  const activePage = activeDocument
    ? getEditableActivePage(activeDocument, {
        notebookTransition,
      })
    : undefined;

  const displayedPaperType =
    activePage?.paperType ?? paperType;

  const displayedPaperColor =
    activePage?.paperColor ?? paperColor;

  const displayedPatternColor =
    activePage?.patternColor ?? "#72a0b9";

  const displayedPatternOpacity =
    activePage?.patternOpacity ?? 14;

  const displayedPatternSize =
    activePage?.patternSize ?? 18;

  const applyPageAppearance = (
    updates: PageAppearanceUpdate,
  ) => {
    if (!activeDocument || !activePage) {
      return;
    }

    recordHistory(documents);

    if (applyToAllPages) {
      const updatedAt = new Date().toISOString();

      updateDocument(activeDocument.id, {
        pages: activeDocument.pages.map((page) => ({
          ...page,
          ...updates,
          updatedAt,
        })),
      });

      return;
    }

    updatePage(activePage.id, updates);
  };

  const handlePaperTypeChange = (
    nextPaperType: PaperType,
  ) => {
    setPaperType(nextPaperType);

    const defaultSize =
      nextPaperType === "dotted"
        ? 18
        : nextPaperType === "lined"
          ? 25
          : 22;

    applyPageAppearance({
      paperType: nextPaperType,
      patternSize: defaultSize,
    });
  };

  const handlePaperColorChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextColor = event.target.value;

    setPaperColor(nextColor);

    applyPageAppearance({
      paperColor: nextColor,
    });
  };

  const handleDocumentColorValue = (
    field:
      | "coverColor"
      | "spineColor"
      | "coverBorderColor",
    nextColor: string,
  ) => {
    if (!activeDocument) {
      return;
    }

    recordHistory(documents);

    updateDocument(activeDocument.id, {
      [field]: nextColor,
    });
  };

  return (
    <div className="paper-settings">
      <label className="paper-settings-checkbox">
        <input
          type="checkbox"
          checked={applyToAllPages}
          onChange={(event) =>
            setApplyToAllPages(event.target.checked)
          }
        />

        <span>Aplicar a todas as folhas</span>
      </label>

      <div>
        <label
          htmlFor="paper-pattern"
          className="control-label"
        >
          Tipo de folha
        </label>

        <select
          id="paper-pattern"
          value={displayedPaperType}
          onChange={(event) =>
            handlePaperTypeChange(
              event.target.value as PaperType,
            )
          }
          className="paper-select"
        >
          {patterns.map((pattern) => (
            <option
              key={pattern.value}
              value={pattern.value}
            >
              {pattern.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="document-cover-color"
          className="control-label"
        >
          Cor da capa
        </label>

        <input
          id="document-cover-color"
          type="color"
          value={
            activeDocument?.coverColor ?? "#bde4eb"
          }
          onChange={(event) =>
            handleDocumentColorValue(
              "coverColor",
              event.target.value,
            )
          }
          className="paper-color-input"
        />
      </div>

      <div>
        <label
          htmlFor="document-cover-border"
          className="control-label"
        >
          Cor da borda e costura
        </label>

        <input
          id="document-cover-border"
          type="color"
          value={
            activeDocument?.coverBorderColor ??
            "#8dcbd7"
          }
          onChange={(event) =>
            handleDocumentColorValue(
              "coverBorderColor",
              event.target.value,
            )
          }
          className="paper-color-input"
        />
      </div>

      <div>
        <label
          htmlFor="document-spine-color"
          className="control-label"
        >
          Cor da lombada
        </label>

        <input
          id="document-spine-color"
          type="color"
          value={
            activeDocument?.spineColor ?? "#bdeff3"
          }
          onChange={(event) =>
            handleDocumentColorValue(
              "spineColor",
              event.target.value,
            )
          }
          className="paper-color-input"
        />
      </div>

      <div>
        <label
          htmlFor="paper-color"
          className="control-label"
        >
          Cor da folha
        </label>

        <input
          id="paper-color"
          type="color"
          value={displayedPaperColor}
          onChange={handlePaperColorChange}
          className="paper-color-input"
        />
      </div>

      {displayedPaperType !== "blank" && (
        <>
          <div>
            <label
              htmlFor="pattern-color"
              className="control-label"
            >
              Cor da pauta
            </label>

            <input
              id="pattern-color"
              type="color"
              value={displayedPatternColor}
              onChange={(event) =>
                applyPageAppearance({
                  patternColor: event.target.value,
                })
              }
              className="paper-color-input"
            />
          </div>

          <label className="paper-range-control">
            <span>Intensidade da pauta</span>

            <output>
              {displayedPatternOpacity}%
            </output>

            <input
              type="range"
              min="2"
              max="40"
              step="1"
              value={displayedPatternOpacity}
              onChange={(event) =>
                applyPageAppearance({
                  patternOpacity: Number(
                    event.target.value,
                  ),
                })
              }
            />
          </label>

          <label className="paper-range-control">
            <span>Espaçamento da pauta</span>

            <output>
              {displayedPatternSize}px
            </output>

            <input
              type="range"
              min="10"
              max="40"
              step="1"
              value={displayedPatternSize}
              onChange={(event) =>
                applyPageAppearance({
                  patternSize: Number(
                    event.target.value,
                  ),
                })
              }
            />
          </label>
        </>
      )}
    </div>
  );
}
