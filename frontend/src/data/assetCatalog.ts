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
    width: 209,
    height: 73,
  },
  stationerySheet: {
    id: "stationery-sheet",
    category: "stickers",
    label: "Papelaria azul",
    src: circleDashed,
    width: 188,
    height: 188,
  },
  notepadReference: {
    id: "notepad-reference",
    category: "images",
    label: "Bloco de notas",
    src: paperFrame,
    width: 271,
    height: 424,
  },
  cadernoCores: {
    id: "caderno-cores",
    category: "images",
    label: "Caderno colorido",
    src: moctesLogo,
    width: 14,
    height: 13,
  },
  paperNote: {
    id: "paper-note",
    category: "post-its",
    label: "Folha clara",
    src: paperBlank,
    width: 202,
    height: 154,
  },
  linedPaper: {
    id: "lined-paper",
    category: "post-its",
    label: "Folha pautada",
    src: paperLines,
    width: 357,
    height: 396,
  },
  dottedNote: {
    id: "dotted-note",
    category: "post-its",
    label: "Folha pontilhada",
    src: circleDots,
    width: 188,
    height: 188,
  },
  gridNote: {
    id: "grid-note",
    category: "post-its",
    label: "Folha quadriculada",
    src: circleSquares,
    width: 188,
    height: 188,
  },
  tapeBlue: {
    id: "tape-blue",
    category: "tapes",
    label: "Tape azul",
    src: tapeForm,
    width: 446,
    height: 43,
  },
  tapeGreen: {
    id: "tape-green",
    category: "tapes",
    label: "Tape verde",
    src: tapeFlower,
    width: 446,
    height: 43,
  },
  tapeOrange: {
    id: "tape-orange",
    category: "tapes",
    label: "Tape laranja",
    src: tapeForm,
    width: 446,
    height: 43,
  },
} satisfies Record<string, SidebarAsset>;

export const sidebarAssets: SidebarAsset[] = Object.values(assetCatalog);
