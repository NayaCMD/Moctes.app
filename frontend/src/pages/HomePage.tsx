import { DocumentWorkspace } from "../components/documents/DocumentWorkspace";
import { AppLayout } from "../components/layout/AppLayout";

export function HomePage() {
    return (
        <AppLayout>
            <DocumentWorkspace />
        </AppLayout>
    );
}
