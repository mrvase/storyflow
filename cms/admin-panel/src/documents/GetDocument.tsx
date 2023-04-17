import React from "react";
import { DocumentId, TemplateDocument } from "@storyflow/backend/types";
import { useDocument } from ".";

export const GetDocument = ({
  id,
  children,
}: {
  id: DocumentId;
  children: (article: TemplateDocument) => React.ReactNode;
}) => {
  let { article } = useDocument(id);
  if (!article) return null;
  return <>{children(article)}</>;
};
