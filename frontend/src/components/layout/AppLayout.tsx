import type { CSSProperties, ReactNode } from "react";
import { EDITOR_LAYOUT } from "../../config/documentGeometry";
import { useVisualViewportMetrics } from "../../hooks/useResponsiveEditor";
import { useWorkspaceCapabilities } from "../../hooks/useWorkspaceCapabilities";
import { AssetDragPreview } from "../editor/AssetDragPreview";
import { ElementContextMenu } from "../editor/ElementContextMenu";
import { TextToolbar } from "../editor/TextToolbar";
import { Sidebar } from "../sidebar/Sidebar";
import { BottomToolbar } from "../toolbar/BottomToolbar";
import { DesktopWindow } from "./DesktopWindow";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  children: ReactNode;
  editor?: boolean;
}

export function AppLayout({ children, editor = true }: AppLayoutProps) {
  useVisualViewportMetrics();
  const { canEdit } = useWorkspaceCapabilities();
  const layoutStyle = {
    "--editor-document-margin-x": `${EDITOR_LAYOUT.documentMarginX}px`,
    "--editor-document-margin-top": `${EDITOR_LAYOUT.documentMarginTop}px`,
    "--editor-document-margin-bottom": `${EDITOR_LAYOUT.documentMarginBottom}px`,
    "--editor-bottom-dock-reserved-height": `${EDITOR_LAYOUT.bottomDockReservedHeight}px`,
    "--editor-context-toolbar-reserved-height": `${EDITOR_LAYOUT.contextualToolbarReservedHeight}px`,
    "--editor-zoom-controls-reserved-width": `${EDITOR_LAYOUT.zoomControlsReservedWidth}px`,
  } as CSSProperties;

  return (
    <DesktopWindow>
      <AppHeader />

      <div className="moctes-shell" data-editor={editor}>
        {editor && <Sidebar />}

        <div className="moctes-stage" data-editor={editor} style={layoutStyle}>
          {children}
          {editor && canEdit && (
            <>
              <div className="editor-chrome-layer" aria-label="Controles do editor">
                <TextToolbar />
                <ElementContextMenu />
                <AssetDragPreview />
              </div>
              <div className="bottom-dock-layer">
                <BottomToolbar />
              </div>
            </>
          )}
          {editor && !canEdit && (
            <div className="bottom-dock-layer">
              <BottomToolbar />
            </div>
          )}
        </div>
      </div>
    </DesktopWindow>
  );
}
