import moctesLogo from "../assets/moctes-logo.svg";
import circleDashed from "../assets/moctes/post-its/circle-dashed.svg";
import circleDots from "../assets/moctes/post-its/circle-dots.svg";
import circleSquares from "../assets/moctes/post-its/circle-squares.svg";
import flag from "../assets/moctes/post-its/flag.svg";
import paperBlank from "../assets/moctes/post-its/paper-blank.svg";
import paperFrame from "../assets/moctes/post-its/paper-frame.svg";
import paperLines from "../assets/moctes/post-its/paper-lines.svg";
import tapeFlower from "../assets/moctes/tapes/tape-Flower.png";
import tapeForm from "../assets/moctes/tapes/tape-form.png";
import type { SidebarAsset } from "../types/document.types";

export const assetCatalog = {
  stickerSheet: {
    id: "sticker-sheet",
    category: "stickers",
    label: "Cartela Moctes",
    src: flag,
  },
  stationerySheet: {
    id: "stationery-sheet",
    category: "stickers",
    label: "Papelaria azul",
    src: circleDashed,
  },
  notepadReference: {
    id: "notepad-reference",
    category: "images",
    label: "Bloco de notas",
    src: paperFrame,
  },
  cadernoCores: {
    id: "caderno-cores",
    category: "images",
    label: "Caderno colorido",
    src: moctesLogo,
  },
  paperNote: {
    id: "paper-note",
    category: "post-its",
    label: "Folha clara",
    src: paperBlank,
  },
  linedPaper: {
    id: "lined-paper",
    category: "post-its",
    label: "Folha pautada",
    src: paperLines,
  },
  dottedNote: {
    id: "dotted-note",
    category: "post-its",
    label: "Folha pontilhada",
    src: circleDots,
  },
  gridNote: {
    id: "grid-note",
    category: "post-its",
    label: "Folha quadriculada",
    src: circleSquares,
  },
  tapeBlue: {
    id: "tape-blue",
    category: "tapes",
    label: "Tape azul",
    src: tapeForm,
  },
  tapeGreen: {
    id: "tape-green",
    category: "tapes",
    label: "Tape verde",
    src: tapeFlower,
  },
  tapeOrange: {
    id: "tape-orange",
    category: "tapes",
    label: "Tape laranja",
    src: tapeForm,
  },
} satisfies Record<string, SidebarAsset>;

export const sidebarAssets: SidebarAsset[] = Object.values(assetCatalog);
