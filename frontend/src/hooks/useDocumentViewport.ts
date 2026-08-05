import { useEffect, useMemo, useRef, useState } from "react";
import {
    calculateDocumentViewport,
    DOCUMENT_GEOMETRY,
    type CalculatedDocumentViewport,
    type DocumentGeometry,
    type ViewportSize,
} from "../config/documentGeometry";
import type { DocumentType } from "../types/document.types";
import type { ZoomMode } from "../types/editor.types";

export interface DocumentViewport extends CalculatedDocumentViewport {
    viewportRef: React.RefObject<HTMLDivElement | null>;
    geometry: DocumentGeometry;
    availableSize: ViewportSize;
}

const fallbackSize: ViewportSize = {
    width: 900,
    height: 620,
};

export function useDocumentViewport(
    documentType: DocumentType,
    zoom: number,
    zoomMode: ZoomMode,
): DocumentViewport {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const [availableSize, setAvailableSize] = useState<ViewportSize>(fallbackSize);
    const geometry = DOCUMENT_GEOMETRY[documentType];

    useEffect(() => {
        const element = viewportRef.current;
        if (!element) {
            return;
        }

        const updateSize = () => {
            const rect = element.getBoundingClientRect();
            setAvailableSize({
                width: Math.max(1, rect.width),
                height: Math.max(1, rect.height),
            });
        };

        updateSize();

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateSize);
            return () => window.removeEventListener("resize", updateSize);
        }

        const observer = new ResizeObserver(updateSize);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const viewport = useMemo(
        () => calculateDocumentViewport(availableSize, geometry, zoom, zoomMode),
        [availableSize, geometry, zoom, zoomMode],
    );

    return {
        viewportRef,
        geometry,
        availableSize,
        ...viewport,
    };
}
