import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type {
  NotebookDividerUpdate,
  NotebookSection,
  RemoveSectionStrategy,
} from "../../types/notebook.types";
import {
  clampNotebookTabPosition,
  NOTEBOOK_TAB_DRAG_THRESHOLD_PX,
  NOTEBOOK_TAB_KEYBOARD_LARGE_STEP,
  NOTEBOOK_TAB_KEYBOARD_STEP,
} from "../../utils/notebookTabs.utils";
import { NotebookDividerSettings } from "./NotebookDividerSettings";
import { NotebookSectionDialog } from "./NotebookSectionDialog";
import { NotebookSectionMenu } from "./NotebookSectionMenu";
import { NotebookSectionRemoveDialog } from "./NotebookSectionRemoveDialog";

interface NotebookTabsProps {
  documentId: string;
  sections: NotebookSection[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  disabled?: boolean;
  editable?: boolean;
}

export function NotebookTabs({
  documentId,
  sections,
  activeSectionId,
  onSelectSection,
  disabled = false,
  editable = true,
}: NotebookTabsProps) {
  const addSection = useDocumentStore((state) => state.addSection);
  const renameSection = useDocumentStore((state) => state.renameSection);
  const reorderSections = useDocumentStore((state) => state.reorderSections);
  const removeSection = useDocumentStore((state) => state.removeSection);
  const updateNotebookDivider = useDocumentStore((state) => state.updateNotebookDivider);
  const cancelNotebookTransition = useEditorStore((state) => state.cancelNotebookTransition);
  const [dialogMode, setDialogMode] = useState<"add" | "rename" | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [settingsSectionId, setSettingsSectionId] = useState<string | null>(null);
  const [removeSectionId, setRemoveSectionId] = useState<string | null>(null);
  const removingSectionPageCount = useDocumentStore((state) => {
    const document = state.documents.find((item) => item.id === documentId);
    return document?.pages.filter((page) => page.sectionId === removeSectionId).length ?? 0;
  });
  const [dragPreview, setDragPreview] = useState<{ sectionId: string; position: number } | null>(null);
  const tabsRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{
    sectionId: string;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    initialPosition: number;
    didDrag: boolean;
    suppressClick: boolean;
  } | null>(null);
  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? null;
  const settingsSection = sections.find((section) => section.id === settingsSectionId) ?? null;
  const removingSection = sections.find((section) => section.id === removeSectionId) ?? null;

  const runStructuralAction = (action: () => void) => {
    cancelNotebookTransition(documentId);
    action();
  };

  const commitTabPosition = (sectionId: string, position: number) => {
    const section = sections.find((item) => item.id === sectionId);
    const nextPosition = clampNotebookTabPosition(Math.round(position));
    if (!section || section.divider.tabPosition === nextPosition) {
      return;
    }

    runStructuralAction(() => {
      updateNotebookDivider(documentId, sectionId, { tabPosition: nextPosition });
    });
  };

  const readTabPositionFromPointer = (
    event: PointerEvent | ReactPointerEvent<HTMLElement>,
    offsetX: number,
  ): number => {
    const tabsRect = tabsRef.current?.getBoundingClientRect();
    if (!tabsRect || tabsRect.width <= 0) {
      return 0;
    }

    const left = event.clientX - tabsRect.left - offsetX;
    return clampNotebookTabPosition((left / tabsRect.width) * 100);
  };

  const beginTabPointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
    section: NotebookSection,
  ) => {
    if (disabled || !editable || event.button !== 0) {
      return;
    }

    const target = event.currentTarget;
    const tabRect = target.getBoundingClientRect();
    dragStateRef.current = {
      sectionId: section.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - tabRect.left,
      initialPosition: clampNotebookTabPosition(section.divider.tabPosition),
      didDrag: false,
      suppressClick: false,
    };
    target.setPointerCapture(event.pointerId);
  };

  const moveTabPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const distanceX = Math.abs(event.clientX - dragState.startX);
    const distanceY = Math.abs(event.clientY - dragState.startY);
    if (!dragState.didDrag && Math.max(distanceX, distanceY) < NOTEBOOK_TAB_DRAG_THRESHOLD_PX) {
      return;
    }

    dragState.didDrag = true;
    dragState.suppressClick = true;
    event.preventDefault();
    setDragPreview({
      sectionId: dragState.sectionId,
      position: readTabPositionFromPointer(event, dragState.offsetX),
    });
  };

  const endTabPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (dragState.didDrag) {
      event.preventDefault();
      commitTabPosition(
        dragState.sectionId,
        readTabPositionFromPointer(event, dragState.offsetX),
      );
    }

    dragStateRef.current = dragState.suppressClick ? { ...dragState } : null;
    setDragPreview(null);
  };

  const clearTabPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (dragState?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setDragPreview(null);
    }
  };

  const handleTabClick = (sectionId: string) => {
    const dragState = dragStateRef.current;
    if (dragState?.sectionId === sectionId && dragState.suppressClick) {
      dragStateRef.current = null;
      return;
    }

    onSelectSection(sectionId);
  };

  const moveFocusedTab = (section: NotebookSection, step: number) => {
    commitTabPosition(
      section.id,
      clampNotebookTabPosition(section.divider.tabPosition + step),
    );
  };

  const handleAddOrRename = (values: { title: string; color?: string }) => {
    if (dialogMode === "add") {
      runStructuralAction(() => {
        addSection(documentId, { title: values.title, color: values.color });
      });
      setDialogMode(null);
      return;
    }

    if (selectedSection) {
      runStructuralAction(() => {
        renameSection(documentId, selectedSection.id, values.title);
      });
    }
    setDialogMode(null);
    setSelectedSectionId(null);
  };

  const handleUpdateDivider = (updates: NotebookDividerUpdate) => {
    if (settingsSection) {
      runStructuralAction(() => {
        updateNotebookDivider(documentId, settingsSection.id, updates);
      });
    }
    setSettingsSectionId(null);
  };

  const handleRemoveSection = (strategy: RemoveSectionStrategy) => {
    if (removingSection) {
      runStructuralAction(() => {
        removeSection(documentId, removingSection.id, strategy);
      });
    }
    setRemoveSectionId(null);
  };

  return (
    <nav ref={tabsRef} className="notebook-tabs" aria-label="Seções do caderno">
      {sections.map((section, index) => {
        const title = section.title.trim() || "Seção sem título";
        const tabPosition = dragPreview?.sectionId === section.id
          ? dragPreview.position
          : clampNotebookTabPosition(section.divider.tabPosition);
        const collisionOffset = index * 2;
        const style = {
          "--notebook-tab-color": section.divider.tabColor,
          "--notebook-tab-text-color": section.divider.textColor,
          "--notebook-tab-position": `${tabPosition}%`,
          "--notebook-tab-collision-offset": `${collisionOffset}px`,
        } as CSSProperties;

        return (
          <span key={section.id} className="notebook-tab-shell" style={style}>
            <button
              type="button"
              className="notebook-tab"
              aria-current={activeSectionId === section.id ? "true" : undefined}
              aria-label={`Abrir divisória ${title}`}
              disabled={disabled}
              title={title}
              onPointerDown={(event) => beginTabPointer(event, section)}
              onPointerMove={moveTabPointer}
              onPointerUp={endTabPointer}
              onPointerCancel={clearTabPointer}
              onClick={() => handleTabClick(section.id)}
              onKeyDown={(event) => {
                if (!event.altKey || disabled || !editable) {
                  return;
                }
                const direction =
                  event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
                if (!direction) {
                  return;
                }
                event.preventDefault();
                moveFocusedTab(
                  section,
                  direction * (event.shiftKey ? NOTEBOOK_TAB_KEYBOARD_LARGE_STEP : NOTEBOOK_TAB_KEYBOARD_STEP),
                );
              }}
            >
              <span>{title}</span>
            </button>
            <NotebookSectionMenu
              sectionTitle={title}
              disabled={disabled || !editable}
              canMoveLeft={index > 0}
              canMoveRight={index < sections.length - 1}
              onRename={() => {
                setSelectedSectionId(section.id);
                setDialogMode("rename");
              }}
              onCustomize={() => setSettingsSectionId(section.id)}
              onMoveLeft={() =>
                runStructuralAction(() => reorderSections(documentId, index, index - 1))
              }
              onMoveRight={() =>
                runStructuralAction(() => reorderSections(documentId, index, index + 1))
              }
              onRemove={() => setRemoveSectionId(section.id)}
            />
          </span>
        );
      })}
      <button
        type="button"
        className="notebook-add-section-button"
        aria-label="Adicionar seção"
        disabled={disabled || !editable}
        onClick={() => {
          setSelectedSectionId(null);
          setDialogMode("add");
        }}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
      {dialogMode && (
        <NotebookSectionDialog
          key={`${dialogMode}-${selectedSection?.id ?? "new"}`}
          open
          mode={dialogMode}
          initialTitle={dialogMode === "rename" ? selectedSection?.title ?? "" : ""}
          initialColor={selectedSection?.divider.color}
          onSubmit={handleAddOrRename}
          onCancel={() => {
            setDialogMode(null);
            setSelectedSectionId(null);
          }}
        />
      )}
      {settingsSection && (
        <NotebookDividerSettings
          key={settingsSection.id}
          open
          section={settingsSection}
          onSave={handleUpdateDivider}
          onCancel={() => setSettingsSectionId(null)}
        />
      )}
      {removingSection && (
        <NotebookSectionRemoveDialog
          key={removingSection.id}
          open
          section={removingSection}
          sections={sections}
          pageCount={removingSectionPageCount}
          onConfirm={handleRemoveSection}
          onCancel={() => setRemoveSectionId(null)}
        />
      )}
    </nav>
  );
}
