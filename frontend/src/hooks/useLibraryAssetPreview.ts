import { useEffect, useState } from "react";
import { useAssetLibraryStore } from "../stores/useAssetLibraryStore";
import type { LibraryAsset } from "../types/asset.types";
import { IMPORTED_ASSET_SRC_PREFIX } from "../utils/assetLibrary.utils";
import { indexedDbAssetStorage } from "../services/assetStorage/indexedDbAssetStorage";

export function useLibraryAssetPreview(asset: LibraryAsset | null | undefined): string | null {
    const [objectUrl, setObjectUrl] = useState<{ assetId: string; url: string } | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        let active = true;

        if (!asset || asset.source === "built-in") {
            return () => undefined;
        }
        void indexedDbAssetStorage.getAssetBlob(asset.id).then((blob) => {
            if (!active || !blob) {
                return;
            }
            objectUrl = URL.createObjectURL(blob);
            setObjectUrl({ assetId: asset.id, url: objectUrl });
        });

        return () => {
            active = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [asset]);

    if (!asset) {
        return null;
    }

    return asset.source === "built-in" ? asset.src : objectUrl?.assetId === asset.id ? objectUrl.url : null;
}

export function useElementAssetPreview(assetId: string | undefined, fallbackSrc: string): string | null {
    const asset = useAssetLibraryStore((state) =>
        assetId ? state.assets.find((item) => item.id === assetId) : undefined,
    );
    const preview = useLibraryAssetPreview(asset);

    if (fallbackSrc.startsWith(IMPORTED_ASSET_SRC_PREFIX)) {
        return preview;
    }

    return preview ?? fallbackSrc;
}
