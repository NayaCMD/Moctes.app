import { Image, Link, MessageCircle, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EDITOR_Z_INDEX } from "../../config/editorZIndex";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { CommentElementContent, PageElement } from "../../types/element.types";

interface CommentElementProps {
  element: PageElement;
}

interface ThreadPosition {
  left: number;
  top: number;
}

const THREAD_WIDTH = 292;
const THREAD_HEIGHT = 330;
const VIEWPORT_PADDING = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getThreadPosition(marker: HTMLElement): ThreadPosition {
  const rect = marker.getBoundingClientRect();
  const preferRight = rect.right + THREAD_WIDTH + VIEWPORT_PADDING < window.innerWidth;
  const left = preferRight ? rect.right + 10 : rect.left - THREAD_WIDTH - 10;
  const top = rect.top + rect.height / 2 - THREAD_HEIGHT / 2;

  return {
    left: clamp(left, VIEWPORT_PADDING, window.innerWidth - THREAD_WIDTH - VIEWPORT_PADDING),
    top: clamp(top, VIEWPORT_PADDING, window.innerHeight - THREAD_HEIGHT - VIEWPORT_PADDING),
  };
}

export function CommentElement({ element }: CommentElementProps) {
  const markerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [markerElement, setMarkerElement] = useState<HTMLElement | null>(null);

  if (element.content.kind !== "comment") {
    return null;
  }

  const content = element.content;
  const latestMessage = content.messages.at(-1);

  return (
    <span className="page-comment-element">
      <button
        ref={markerRef}
        type="button"
        className="comment-marker"
        data-resolved={content.resolved}
        style={{ backgroundColor: content.color }}
        title={content.resolved ? "Comentário resolvido" : latestMessage?.text ?? "Comentário"}
        aria-label={content.resolved ? "Comentário resolvido" : "Abrir comentário"}
        aria-expanded={open}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setMarkerElement(event.currentTarget);
          setOpen((current) => !current);
        }}
      >
        <MessageCircle size={16} />
        {content.messages.length > 1 && (
          <span className="comment-marker-count">{content.messages.length}</span>
        )}
      </button>

      {open && markerElement && (
        <CommentThreadPopover
          elementId={element.id}
          content={content}
          markerElement={markerElement}
          onClose={() => {
            setOpen(false);
            markerElement.focus({ preventScroll: true });
          }}
        />
      )}
    </span>
  );
}

function CommentThreadPopover({
  elementId,
  content,
  markerElement,
  onClose,
}: {
  elementId: string;
  content: CommentElementContent;
  markerElement: HTMLElement;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [position, setPosition] = useState(() => getThreadPosition(markerElement));
  const popoverRef = useRef<HTMLFormElement | null>(null);
  const documents = useDocumentStore((state) => state.documents);
  const updateElement = useDocumentStore((state) => state.updateElement);
  const deleteElement = useDocumentStore((state) => state.deleteElement);
  const recordHistory = useEditorStore((state) => state.recordHistory);

  useEffect(() => {
    const update = () => setPosition(getThreadPosition(markerElement));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [markerElement]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (popoverRef.current?.contains(target) || markerElement.contains(target))) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [markerElement, onClose]);

  useEffect(() => {
    popoverRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, []);

  const updateContent = (updates: Partial<typeof content>) => {
    recordHistory(documents);
    updateElement(elementId, {
      content: {
        ...content,
        ...updates,
      },
    });
  };

  return createPortal(
    <form
      ref={popoverRef}
      className="comment-thread-popover"
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        width: THREAD_WIDTH,
        zIndex: EDITOR_Z_INDEX.commentThread,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        const text = draft.trim();
        if (!text) {
          return;
        }
        const createdAt = new Date().toISOString();
        updateContent({
          messages: [
            ...content.messages,
            {
              id: `msg-${crypto.randomUUID()}`,
              authorLabel: "Usuária",
              text,
              createdAt,
              attachments: [],
            },
          ],
        });
        setDraft("");
      }}
    >
      <header>
        <strong>{content.resolved ? "Resolvido" : "Comentário"}</strong>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </header>
      <div className="comment-thread-messages">
        {content.messages.map((message) => (
          <p key={message.id}>
            <b>{message.authorLabel}</b>
            <time>{new Date(message.createdAt).toLocaleDateString("pt-BR")}</time>
            <span>{message.text}</span>
          </p>
        ))}
      </div>
      <label>
        <span className="sr-only">Nova mensagem</span>
        <input value={draft} placeholder="Responder..." onChange={(event) => setDraft(event.target.value)} />
      </label>
      <div className="comment-attachment-actions" aria-label="Anexos">
        <button type="button" disabled>
          <Image size={14} />
          Imagem
        </button>
        <button type="button" disabled>
          <Link size={14} />
          Link
        </button>
        <button type="button" disabled>
          <Video size={14} />
          Vídeo
        </button>
      </div>
      <div className="comment-thread-actions">
        <button type="submit">Enviar</button>
        <button type="button" onClick={() => updateContent({ resolved: !content.resolved })}>
          {content.resolved ? "Reabrir" : "Resolver"}
        </button>
        <button
          type="button"
          onClick={() => {
            recordHistory(documents);
            deleteElement(elementId);
            onClose();
          }}
        >
          Excluir
        </button>
      </div>
    </form>,
    document.body,
  );
}
