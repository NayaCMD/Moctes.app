import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/notebook.css";
import "./styles/notebook-cover.css";
import "./styles/notebook-divider.css";
import "./styles/notebook-tabs.css";
import "./styles/notebook-page.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
