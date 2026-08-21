import type { PageElement, TextElementStyle } from "../types/element.types";
import type {
  InstantiatedPageTemplate,
  PageTemplateDefinition,
  PageTemplateId,
} from "../types/pageTemplate.types";
import type { PaperAppearance } from "../types/page.types";
import { createChecklistElement } from "../utils/checklist.utils";
import { normalizePaperAppearance } from "../utils/paperAppearance.utils";
import { createShapeAppearance } from "../utils/shape.utils";

export const PAGE_TEMPLATES: PageTemplateDefinition[] = [
  { id: "diary", name: "Diário", description: "Registro do dia, humor e memórias.", category: "reflection", recommendedFor: ["notebook", "notepad"] },
  { id: "daily-planner", name: "Planejamento diário", description: "Prioridades, agenda e notas do dia.", category: "planning", recommendedFor: ["notebook", "notepad", "clipboard"] },
  { id: "studies", name: "Estudos", description: "Objetivos, resumo e dúvidas da matéria.", category: "productivity", recommendedFor: ["notebook", "notepad"] },
  { id: "moodboard", name: "Moodboard", description: "Referências, paleta e direção visual.", category: "creative", recommendedFor: ["notebook", "clipboard"] },
  { id: "checklist", name: "Checklist", description: "Lista de tarefas pronta para usar.", category: "productivity", recommendedFor: ["notebook", "notepad", "clipboard"] },
  { id: "weekly", name: "Planejamento semanal", description: "Visão dos sete dias da semana.", category: "planning", recommendedFor: ["notebook", "notepad"] },
  { id: "monthly", name: "Planejamento mensal", description: "Metas, eventos e foco do mês.", category: "planning", recommendedFor: ["notebook", "notepad"] },
  { id: "project", name: "Página de projeto", description: "Objetivo, entregas, tarefas e notas.", category: "productivity", recommendedFor: ["notebook", "clipboard"] },
  { id: "blank", name: "Página em branco", description: "Comece livremente com o papel atual.", category: "basic", recommendedFor: ["notebook", "notepad", "clipboard"] },
];

export function getPageTemplateDefinition(templateId: PageTemplateId): PageTemplateDefinition {
  return PAGE_TEMPLATES.find((template) => template.id === templateId) ?? PAGE_TEMPLATES.at(-1)!;
}

export function instantiatePageTemplate(
  templateId: PageTemplateId,
  baseAppearance: PaperAppearance,
): InstantiatedPageTemplate {
  const definition = getPageTemplateDefinition(templateId);
  const appearance = templateAppearance(templateId, baseAppearance);
  const elements = templateElements(templateId).map((element, index) => ({
    ...element,
    zIndex: index + 1,
  }));
  return {
    definition,
    title: definition.name,
    appearance,
    elements,
  };
}

function templateAppearance(
  templateId: PageTemplateId,
  base: PaperAppearance,
): PaperAppearance {
  switch (templateId) {
    case "diary":
      return normalizePaperAppearance({ ...base, paperType: "dotted", paperColor: "#fffaf3", paperTexture: "fiber", textureIntensity: 11, patternOpacity: 11, patternSize: 19 });
    case "daily-planner":
    case "weekly":
    case "monthly":
      return normalizePaperAppearance({ ...base, paperType: "grid", paperColor: "#fbfcff", patternColor: "#94a9c8", patternOpacity: 10, patternSize: 22, paperTexture: "grain", textureIntensity: 7 });
    case "studies":
      return normalizePaperAppearance({ ...base, paperType: "lined", paperColor: "#fffdf8", patternColor: "#7893ad", patternOpacity: 15, patternSize: 25, margins: { ...base.margins, left: 11, visible: true } });
    case "moodboard":
      return normalizePaperAppearance({ ...base, paperType: "blank", paperColor: "#fff8f5", paperTexture: "grain", textureIntensity: 10, margins: { ...base.margins, visible: false } });
    case "checklist":
    case "project":
      return normalizePaperAppearance({ ...base, paperType: "dotted", paperColor: "#fbfdff", patternOpacity: 10, patternSize: 18 });
    case "blank":
      return normalizePaperAppearance(base);
  }
}

function templateElements(templateId: PageTemplateId): PageElement[] {
  switch (templateId) {
    case "diary":
      return [
        text("Meu diário", 9, 7, 58, 10, { fontSize: 29, fontWeight: 800, color: "#6f87dc" }),
        text("Data: ____ / ____ / ______", 69, 8, 23, 6, { fontSize: 10, textAlign: "right", color: "#71809b" }),
        text("Como estou me sentindo hoje?", 9, 22, 52, 7, { fontSize: 15, fontWeight: 750, color: "#42516d" }),
        shape("rounded-rectangle", "Escreva uma palavra ou cole um emoji", 9, 30, 82, 13, "#eef3ff", "#b7c7ee"),
        text("O que tornou este dia especial?", 9, 49, 67, 7, { fontSize: 15, fontWeight: 750, color: "#42516d" }),
        text("Comece a escrever aqui…", 9, 58, 82, 24, { fontSize: 13, color: "#52617a", lineHeight: 1.55 }),
        text("Uma coisa que quero lembrar", 9, 87, 82, 6, { fontSize: 12, fontStyle: "italic", textAlign: "center", color: "#7084bf" }),
      ];
    case "daily-planner":
      return [
        text("Planejamento diário", 7, 5, 63, 9, { fontSize: 25, fontWeight: 850, color: "#526fd0" }),
        text("Hoje · ____ / ____", 70, 7, 23, 6, { fontSize: 10, textAlign: "right", color: "#71809b" }),
        checklist("3 prioridades", ["Prioridade 1", "Prioridade 2", "Prioridade 3"], 7, 18, 40, 35, "#7b95e5"),
        shape("rounded-rectangle", "Agenda\n08h  __________________\n10h  __________________\n14h  __________________\n18h  __________________", 51, 18, 42, 36, "#fff8e8", "#ead6a5"),
        checklist("Tarefas rápidas", ["Mensagens", "Pendências", "Planejar amanhã"], 7, 57, 40, 37, "#72aaa6"),
        shape("rounded-rectangle", "Notas do dia", 51, 59, 42, 33, "#f2efff", "#c8bced"),
        text("Vitória do dia: __________________________", 8, 95, 84, 3, { fontSize: 9, fontWeight: 700, color: "#65728c" }),
      ];
    case "studies":
      return [
        text("Notas de estudo", 12, 6, 61, 9, { fontSize: 25, fontWeight: 850, color: "#4569bb" }),
        text("Matéria: ____________________", 60, 8, 31, 5, { fontSize: 11, textAlign: "right", color: "#596780" }),
        checklist("Objetivos da sessão", ["Revisar o conteúdo", "Resolver exercícios", "Registrar dúvidas"], 12, 18, 36, 28, "#6686d6"),
        text("Resumo", 53, 18, 38, 6, { fontSize: 16, fontWeight: 800, color: "#4569bb" }),
        text("Escreva os conceitos principais com suas próprias palavras…", 53, 26, 38, 22, { fontSize: 12, color: "#52617a", lineHeight: 1.5 }),
        shape("rounded-rectangle", "Ideia-chave", 12, 53, 79, 13, "#eef5ff", "#a9c0e9"),
        text("Dúvidas para pesquisar", 12, 71, 43, 6, { fontSize: 15, fontWeight: 800, color: "#4569bb" }),
        text("• _________________________________\n• _________________________________\n• _________________________________", 12, 79, 79, 14, { fontSize: 12, color: "#52617a", lineHeight: 1.65 }),
      ];
    case "moodboard":
      return [
        text("Moodboard", 7, 5, 63, 9, { fontSize: 27, fontWeight: 850, color: "#8f668b" }),
        text("Tema / ideia central", 66, 7, 27, 5, { fontSize: 10, textAlign: "right", color: "#806f83" }),
        shape("rounded-rectangle", "Arraste uma imagem", 7, 18, 40, 28, "#f3e6ed", "#d8bccc"),
        shape("rounded-rectangle", "Referência", 52, 18, 41, 20, "#e4eef2", "#b6cdd6"),
        shape("rounded-rectangle", "Textura / detalhe", 52, 42, 41, 27, "#f2eadc", "#d8c5a3"),
        shape("rounded-rectangle", "Imagem principal", 7, 50, 40, 30, "#e9e6f6", "#c5bee3"),
        text("Paleta", 7, 84, 20, 5, { fontSize: 13, fontWeight: 800, color: "#6c5870" }),
        ...["#d9a6b7", "#9fb8c7", "#e9cf9c", "#9e92bd", "#65727d"].map((color, index) => shape("circle", "", 27 + index * 10, 82, 8, 8, color, color)),
        text("Palavras-chave:  ______________________________", 7, 93, 86, 4, { fontSize: 10, color: "#806f83" }),
      ];
    case "checklist":
      return [
        text("Minha checklist", 8, 6, 84, 10, { fontSize: 27, fontWeight: 850, color: "#526fd0" }),
        checklist("Para fazer", ["Adicionar uma tarefa", "Definir prioridade", "Marcar como concluída", "Reordenar os itens"], 8, 20, 84, 60, "#7894df", true),
        text("Dica: dê dois cliques na lista para editar e reordenar.", 8, 88, 84, 5, { fontSize: 10, textAlign: "center", color: "#71809b" }),
      ];
    case "weekly":
      return weeklyElements();
    case "monthly":
      return [
        text("Planejamento mensal", 6, 5, 64, 9, { fontSize: 25, fontWeight: 850, color: "#526fd0" }),
        text("Mês: __________________", 70, 7, 24, 5, { fontSize: 10, textAlign: "right", color: "#71809b" }),
        shape("rounded-rectangle", "Foco do mês", 6, 18, 42, 16, "#eef3ff", "#b9c7ed"),
        shape("rounded-rectangle", "Datas importantes", 52, 18, 42, 16, "#fff4e2", "#e4c99a"),
        checklist("Metas", ["Meta principal", "Meta pessoal", "Meta que posso medir"], 6, 39, 42, 39, "#7894df"),
        checklist("Eventos e lembretes", ["Evento importante", "Prazo", "Compromisso"], 52, 39, 42, 39, "#c18aa8"),
        shape("rounded-rectangle", "Notas do mês", 6, 82, 88, 12, "#f4f1ff", "#c9c1e8"),
      ];
    case "project":
      return [
        text("Página de projeto", 7, 5, 61, 9, { fontSize: 25, fontWeight: 850, color: "#526fd0" }),
        text("Status: Em planejamento", 67, 7, 26, 5, { fontSize: 10, textAlign: "right", color: "#71809b" }),
        shape("rounded-rectangle", "Objetivo\nDescreva o resultado que este projeto deve alcançar.", 7, 18, 86, 16, "#eef3ff", "#b6c6ed"),
        checklist("Próximas ações", ["Definir escopo", "Identificar responsáveis", "Criar primeira entrega"], 7, 39, 42, 35, "#708bdd"),
        shape("rounded-rectangle", "Entregas\n1. __________________\n2. __________________\n3. __________________", 53, 39, 40, 35, "#fff5e6", "#e4ca9d"),
        shape("rounded-rectangle", "Notas, decisões e links", 7, 79, 86, 15, "#f4f1ff", "#c9c1e8"),
      ];
    case "blank":
      return [];
  }
}

function weeklyElements(): PageElement[] {
  const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  return [
    text("Planejamento semanal", 6, 4, 64, 9, { fontSize: 25, fontWeight: 850, color: "#526fd0" }),
    text("Semana: ____ / ____", 69, 6, 25, 5, { fontSize: 10, textAlign: "right", color: "#71809b" }),
    ...days.map((day, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      return shape(
        "rounded-rectangle",
        `${day}\n• __________________\n• __________________`,
        6 + column * 45,
        17 + row * 19,
        index === 6 ? 88 : 42,
        16,
        index > 4 ? "#fff4e5" : "#f2f5ff",
        index > 4 ? "#e4c99c" : "#bcc9ec",
      );
    }),
  ];
}

function text(
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: TextElementStyle,
): PageElement {
  return {
    id: `el-${crypto.randomUUID()}`,
    type: "text",
    x, y, width, height,
    minWidth: 5,
    minHeight: 3,
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    content: { kind: "text", text: value },
    style: { text: { lineHeight: 1.35, ...style } },
  };
}

function shape(
  shapeType: "rounded-rectangle" | "circle",
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: string,
  strokeColor: string,
): PageElement {
  return {
    id: `el-${crypto.randomUUID()}`,
    type: "shape",
    x, y, width, height,
    minWidth: 4,
    minHeight: 4,
    lockAspectRatio: shapeType === "circle",
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    content: {
      kind: "shape",
      shape: shapeType,
      label: label || undefined,
      appearance: createShapeAppearance(shapeType, { fillColor, strokeColor, strokeWidth: 1 }),
    },
    style: {
      text: {
        color: "#52617a",
        fontSize: label.length > 24 ? 9 : 11,
        fontWeight: 700,
        lineHeight: 1.45,
        textAlign: "center",
      },
    },
  };
}

function checklist(
  title: string,
  items: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  accentColor: string,
  paper = false,
): PageElement {
  return {
    ...createChecklistElement({
      x,
      y,
      title,
      items: items.map((item) => ({ text: item })),
      appearance: {
        accentColor,
        surfaceStyle: paper ? "paper" : "transparent",
        backgroundColor: paper ? "#ffffff" : "transparent",
      },
    }),
    width,
    height,
  };
}
