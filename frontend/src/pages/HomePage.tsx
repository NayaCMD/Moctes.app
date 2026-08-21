import { lazy, Suspense } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { useAppStore } from "../stores/useAppStore";
import { retryImport } from "../utils/lazyImport";

const DocumentWorkspace = lazy(() =>
  retryImport(() => import("../components/documents/DocumentWorkspace")).then(
    (module) => ({
      default: module.DocumentWorkspace,
    }),
  ),
);
const ProductArea = lazy(() =>
  retryImport(() => import("../components/product/ProductArea")).then(
    (module) => ({
      default: module.ProductArea,
    }),
  ),
);

export function HomePage() {
  const activeTopTab = useAppStore((state) => state.activeTopTab);
  const editor = activeTopTab === "current-note";

  return (
    <AppLayout editor={editor}>
      <Suspense
        fallback={
          <main className="route-loading" role="status">
            Preparando sua área…
          </main>
        }
      >
        {editor ? <DocumentWorkspace /> : <ProductArea area={activeTopTab} />}
      </Suspense>
    </AppLayout>
  );
}
