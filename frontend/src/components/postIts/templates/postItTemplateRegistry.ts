import type { ComponentType } from "react";
import type { PostItTemplateId } from "../../../types/postIt.types";
import { CircleDashedPostIt } from "./CircleDashedPostIt";

export interface PostItTemplateProps {
  backgroundColor?: string;
  patternColor?: string;
  patternOpacity?: number;
  preserveAspectRatio?: boolean;
  className?: string;
}

export type AvailablePostItTemplateId = "circle-dashed";

export const POST_IT_TEMPLATE_REGISTRY = {
  "circle-dashed": CircleDashedPostIt,
} satisfies Record<AvailablePostItTemplateId, ComponentType<PostItTemplateProps>>;

export function getPostItTemplate(
  templateId: PostItTemplateId,
): ComponentType<PostItTemplateProps> | null {
  return templateId in POST_IT_TEMPLATE_REGISTRY
    ? POST_IT_TEMPLATE_REGISTRY[templateId as AvailablePostItTemplateId]
    : null;
}
