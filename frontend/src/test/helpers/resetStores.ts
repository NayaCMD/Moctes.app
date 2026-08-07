import { useAppStore } from "../../stores/useAppStore";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";

export function resetStores() {
    useAppStore.setState({
        activeTopTab: "current-note",
        activeTool: "text",
        activeDocumentType: "notebook",
        selectedAssetId: null,
        sidebarVisible: true,
        showPageNavigation: true,
        interfaceTheme: "baby-blue",
        paperType: "grid",
        paperColor: "#fffdf8",
    });

    const documentState = useDocumentStore.getInitialState();
    useDocumentStore.setState({
        documents: documentState.documents,
        activeDocumentId: documentState.activeDocumentId,
        activePageId: documentState.activePageId,
        activeDividerId: documentState.activeDividerId,
        selectedElementId: null,
    });

    useEditorStore.setState({
        editorMode: "select",
        activeToolPanel: null,
        interaction: { mode: "idle", elementId: null, preview: null },
        transferPreview: null,
        drawingPreview: null,
        assetDrag: {
            status: "idle",
            assetId: null,
            assetType: null,
            sourceCategory: null,
            previewSrc: null,
            previewAlt: null,
            pointerX: 0,
            pointerY: 0,
            targetPageId: null,
            targetDocumentId: null,
            validDrop: false,
        },
        drawingSettings: {
            mode: "pen",
            color: "#526ed4",
            strokeWidth: 2.2,
            opacity: 0.9,
        },
        ruler: {
            visible: false,
            x: 42,
            y: 52,
            rotation: 0,
            length: 64,
        },
        clipboardElement: null,
        pasteCount: 0,
        undoStack: [],
        redoStack: [],
        contextMenu: { open: false, elementId: null, x: 0, y: 0 },
        visibilityPanelOpen: false,
        visibilityFilters: {
            text: true,
            image: true,
            sticker: true,
            tape: true,
            postIt: true,
            comment: true,
            hidden: false,
        },
        editingTextElementId: null,
        editorZoom: 1,
        zoomMode: "fit",
        notebookBook: null,
        notebookTransition: null,
    });

    const assetState = useAssetLibraryStore.getInitialState();
    useAssetLibraryStore.setState({
        folders: assetState.folders,
        assets: assetState.assets,
        activeFolderId: assetState.activeFolderId,
        selectedAssetId: null,
        searchQuery: "",
        activeTypeFilter: "all",
        sortMode: "recent",
        importStatus: "idle",
        importError: null,
        feedbackMessage: null,
    });

    window.localStorage.clear();
}
