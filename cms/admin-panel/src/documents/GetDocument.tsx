import React from "react";
import { TemplateDocument } from "@storyflow/backend/types";
import { useArticle } from ".";
import { TEMPLATES } from "@storyflow/backend/templates";

export const GetDocument = ({
  id,
  children,
}: {
  id: string;
  children: (article: TemplateDocument) => React.ReactNode;
}) => {
  const defaultTemplate = TEMPLATES.find((el) => el.id === id);
  if (defaultTemplate) return <>{children(defaultTemplate)}</>;
  let { article } = useArticle(id);
  if (!article) return null;
  return <>{children(article)}</>;
};
