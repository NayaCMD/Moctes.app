import cadernoCoresImage from "../assets/moctes/images/caderno-cores.jpg";
import notepadReference from "../assets/moctes/images/notepad-reference.jpg";
import dottedNote from "../assets/moctes/post-its/dotted-note.png";
import gridNote from "../assets/moctes/post-its/grid-note.png";
import linedPaper from "../assets/moctes/post-its/lined-paper.png";
import paperNote from "../assets/moctes/post-its/paper-note.png";
import stationerySheet from "../assets/moctes/stickers/stationery-sheet.jpg";
import stickerSheet from "../assets/moctes/stickers/sticker-sheet.png";
import tapeBlue from "../assets/moctes/tapes/tape-blue.png";
import tapeGreen from "../assets/moctes/tapes/tape-green.png";
import tapeOrange from "../assets/moctes/tapes/tape-orange.png";
import type { SidebarAsset } from "../types/document.types";

export const assetCatalog = {
  stickerSheet: {
    id: "sticker-sheet",
    category: "stickers",
    label: "Cartela Moctes",
    src: stickerSheet,
  },
  stationerySheet: {
    id: "stationery-sheet",
    category: "stickers",
    label: "Papelaria azul",
    src: stationerySheet,
  },
  notepadReference: {
    id: "notepad-reference",
    category: "images",
    label: "Bloco de notas",
    src: notepadReference,
  },
  cadernoCores: {
    id: "caderno-cores",
    category: "images",
    label: "Caderno colorido",
    src: cadernoCoresImage,
  },
  paperNote: {
    id: "paper-note",
    category: "post-its",
    label: "Folha clara",
    src: paperNote,
  },
  linedPaper: {
    id: "lined-paper",
    category: "post-its",
    label: "Folha pautada",
    src: linedPaper,
  },
  dottedNote: {
    id: "dotted-note",
    category: "post-its",
    label: "Folha pontilhada",
    src: dottedNote,
  },
  gridNote: {
    id: "grid-note",
    category: "post-its",
    label: "Folha quadriculada",
    src: gridNote,
  },
  tapeBlue: {
    id: "tape-blue",
    category: "tapes",
    label: "Tape azul",
    src: tapeBlue,
  },
  tapeGreen: {
    id: "tape-green",
    category: "tapes",
    label: "Tape verde",
    src: tapeGreen,
  },
  tapeOrange: {
    id: "tape-orange",
    category: "tapes",
    label: "Tape laranja",
    src: tapeOrange,
  },
} satisfies Record<string, SidebarAsset>;

export const sidebarAssets: SidebarAsset[] = Object.values(assetCatalog);
