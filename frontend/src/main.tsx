import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource/noto-color-emoji";
import "./index.css";
import "./styles/notebook.css";
import "./styles/notebook-cover.css";
import "./styles/notebook-divider.css";
import "./styles/notebook-tabs.css";
import "./styles/notebook-page.css";
import "./styles/notebook-animation.css";
import App from "./App.tsx";
import { isPerformanceLabRoute } from "./performance/performanceLabEnvironment";

const application = <App />;

createRoot(document.getElementById("root")!).render(
    isPerformanceLabRoute() ? application : (
        <StrictMode>
            {application}
        </StrictMode>
    ),
);
