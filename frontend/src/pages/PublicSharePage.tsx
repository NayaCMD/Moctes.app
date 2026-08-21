import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { DocumentPage } from "../components/documents/DocumentPage";
import { loadPublicShare, type PublicDocumentShare } from "../services/sharing";

export function PublicSharePage({ token }: { token: string }) {
  const [share, setShare] = useState<PublicDocumentShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadPublicShare(token).then((response) => {
      if (!active) return;
      if (response.ok) {
        setShare(response.data);
        setActivePageId(response.data.document.activePageId ?? response.data.document.pages[0]?.id ?? null);
      } else setError("Este link não existe, expirou ou foi revogado.");
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (error) return <main className="public-share-status"><h1>Link indisponível</h1><p>{error}</p></main>;
  if (!share) return <main className="public-share-status"><p>Carregando documento...</p></main>;
  const orderedPages = [...share.document.pages].sort((first, second) => first.order - second.order);
  const pageIndex = Math.max(0, orderedPages.findIndex((item) => item.id === activePageId));
  const page = orderedPages[pageIndex];
  if (!page) return <main className="public-share-status"><h1>Documento vazio</h1><p>Este documento ainda não possui páginas.</p></main>;

  return (
    <main className="public-share-page">
      <header>
        <div><span>Moctes</span><h1>{share.document.title}</h1></div>
        <div className="public-share-header-meta"><span>Atualizado em {new Intl.DateTimeFormat("pt-BR").format(new Date(share.updatedAt))}</span><strong>Somente leitura</strong></div>
      </header>
      <div className="public-share-layout">
        <aside aria-label="Páginas do documento">
          <h2><FileText size={17} aria-hidden="true" /> Páginas</h2>
          {orderedPages.map((item, index) => {
            const section = share.document.sections?.find((candidate) => candidate.id === item.sectionId);
            return <button key={item.id} type="button" data-active={item.id === page.id} onClick={() => setActivePageId(item.id)}><span>{index + 1}</span><div><strong>{item.title || `Página ${index + 1}`}</strong>{section && <small>{section.title}</small>}</div></button>;
          })}
        </aside>
        <section className="public-share-viewer">
          <div className="public-share-canvas">
            <DocumentPage page={page} className="public-share-paper" label={page.title ?? share.document.title} interactive={false} />
          </div>
          <nav className="public-share-navigation" aria-label="Navegar entre páginas">
            <button type="button" disabled={pageIndex === 0} onClick={() => setActivePageId(orderedPages[pageIndex - 1]?.id ?? page.id)}><ChevronLeft size={17} /> Anterior</button>
            <span>Página {pageIndex + 1} de {orderedPages.length}</span>
            <button type="button" disabled={pageIndex === orderedPages.length - 1} onClick={() => setActivePageId(orderedPages[pageIndex + 1]?.id ?? page.id)}>Próxima <ChevronRight size={17} /></button>
          </nav>
        </section>
      </div>
    </main>
  );
}
