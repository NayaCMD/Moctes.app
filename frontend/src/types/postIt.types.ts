export type PostItTemplateId =
  | "circle-dashed"
  | "square-lined"
  | "square-grid"
  | "checklist"
  | "ticket"
  | "wavy";

export interface PostItAppearance {
  templateId: PostItTemplateId;
  backgroundColor: string;
  patternColor: string;
  textColor: string;
  patternOpacity: number;
  preserveAspectRatio: boolean;
}

export interface PostItElementContent {
  kind: "post-it";
  text: string;
  appearance: PostItAppearance;
}
