import { lazy, Suspense } from "react";
import { useEditorKeyboardShortcuts } from "./hooks/useEditorKeyboardShortcuts";
import { useAppStore } from "./stores/useAppStore";
import { AuthGate } from "./components/auth/AuthGate";
import { isPerformanceLabRoute } from "./performance/performanceLabEnvironment";
import { retryImport } from "./utils/lazyImport";
import "./styles/auth.css";
import "./styles/sync.css";
import "./styles/collaboration.css";
import "./styles/ui-foundations.css";
import "./styles/tokens.css";
import "./styles/editor-shell.css";
import "./styles/paper-customization.css";
import "./styles/page-templates.css";
import "./styles/assets.css";
import "./styles/mobile-editor.css";
import "./styles/product-areas.css";

const HomePage = lazy(() =>
  retryImport(() => import("./pages/HomePage")).then((module) => ({
    default: module.HomePage,
  })),
);
const PublicSharePage = lazy(() =>
  retryImport(() => import("./pages/PublicSharePage")).then((module) => ({
    default: module.PublicSharePage,
  })),
);
const InvitationAcceptPage = lazy(() =>
  retryImport(() => import("./pages/InvitationAcceptPage")).then((module) => ({
    default: module.InvitationAcceptPage,
  })),
);

const PerformanceLab = import.meta.env.DEV
  ? lazy(() =>
      retryImport(() => import("./performance/PerformanceLab")).then(
        (module) => ({
          default: module.PerformanceLab,
        }),
      ),
    )
  : null;

function App() {
  const interfaceTheme = useAppStore((state) => state.interfaceTheme);
  useEditorKeyboardShortcuts();

  const shareToken = readRouteToken("share");
  if (shareToken) {
    return (
      <div data-theme={interfaceTheme}>
        <Suspense fallback={<RouteFallback />}>
          <PublicSharePage token={shareToken} />
        </Suspense>
      </div>
    );
  }

  const invitationToken = readRouteToken("invite");

  if (isPerformanceLabRoute() && PerformanceLab) {
    return (
      <div data-theme={interfaceTheme}>
        <Suspense fallback={<p>Preparando laboratorio de performance...</p>}>
          <PerformanceLab />
        </Suspense>
      </div>
    );
  }

  return (
    <div data-theme={interfaceTheme}>
      <AuthGate>
        <Suspense fallback={<RouteFallback />}>
          {invitationToken ? (
            <InvitationAcceptPage token={invitationToken} />
          ) : (
            <HomePage />
          )}
        </Suspense>
      </AuthGate>
    </div>
  );
}

export default App;

function readRouteToken(route: "share" | "invite"): string | null {
  const match = window.location.pathname.match(
    new RegExp(`^/${route}/([^/]+)$`),
  );
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function RouteFallback() {
  return (
    <main className="route-loading" role="status">
      Carregando o Moctes…
    </main>
  );
}
