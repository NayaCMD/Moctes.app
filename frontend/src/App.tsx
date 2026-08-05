import { HomePage } from "./pages/HomePage";
import { useEditorKeyboardShortcuts } from "./hooks/useEditorKeyboardShortcuts";
import { useAppStore } from "./stores/useAppStore";

function App() {
    const interfaceTheme = useAppStore((state) => state.interfaceTheme);
    useEditorKeyboardShortcuts();

    return (
        <div data-theme={interfaceTheme}>
            <HomePage />
        </div>
    );
}

export default App;
