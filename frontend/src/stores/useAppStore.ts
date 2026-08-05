import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DocumentType, TopTab } from "../types/document.types";
import type { EditorTool } from "../types/editor.types";
import type { InterfaceTheme, PaperType } from "../types/theme.types";

interface AppState {
  activeTopTab: TopTab;
  activeTool: EditorTool;
  activeDocumentType: DocumentType;
  selectedAssetId: string | null;
  sidebarVisible: boolean;
  showPageNavigation: boolean;
  interfaceTheme: InterfaceTheme;
  paperType: PaperType;
  paperColor: string;
  setActiveTopTab: (tab: TopTab) => void;
  setActiveTool: (tool: EditorTool) => void;
  setActiveDocumentType: (documentType: DocumentType) => void;
  setSelectedAssetId: (assetId: string | null) => void;
  setSidebarVisible: (visible: boolean) => void;
  togglePageNavigation: () => void;
  setInterfaceTheme: (theme: InterfaceTheme) => void;
  setPaperType: (paperType: PaperType) => void;
  setPaperColor: (color: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTopTab: "current-note",
      activeTool: "text",
      activeDocumentType: "notebook",
      selectedAssetId: null,
      sidebarVisible: true,
      showPageNavigation: true,
      interfaceTheme: "baby-blue",
      paperType: "grid",
      paperColor: "#fffdf8",
      setActiveTopTab: (activeTopTab) => set({ activeTopTab }),
      setActiveTool: (activeTool) => set({ activeTool }),
      setActiveDocumentType: (activeDocumentType) =>
        set({ activeDocumentType }),
      setSelectedAssetId: (selectedAssetId) => set({ selectedAssetId }),
      setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
      togglePageNavigation: () =>
        set((state) => ({ showPageNavigation: !state.showPageNavigation })),
      setInterfaceTheme: (interfaceTheme) => set({ interfaceTheme }),
      setPaperType: (paperType) => set({ paperType }),
      setPaperColor: (paperColor) => set({ paperColor }),
    }),
    {
      name: "moctes-preferences",
      partialize: (state) => ({
        activeDocumentType: state.activeDocumentType,
        showPageNavigation: state.showPageNavigation,
        interfaceTheme: state.interfaceTheme,
        paperType: state.paperType,
        paperColor: state.paperColor,
      }),
    },
  ),
);
