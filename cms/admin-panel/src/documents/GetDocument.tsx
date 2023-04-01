import React from "react";
import { DocumentId, TemplateDocument } from "@storyflow/backend/types";
import { useArticle } from ".";

export const GetDocument = ({
  id,
  children,
}: {
  id: DocumentId;
  children: (article: TemplateDocument) => React.ReactNode;
}) => {
  let { article } = useArticle(id);
  if (!article) return null;
  return <>{children(article)}</>;
};
