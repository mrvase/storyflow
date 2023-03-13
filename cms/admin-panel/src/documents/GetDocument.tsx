import React from "react";
import { DocumentId, TemplateDocument } from "@storyflow/backend/types";
import { useArticle } from ".";
import { FIELDS } from "@storyflow/backend";
import { getTemplateDocumentId } from "@storyflow/backend/ids";

export const GetDocument = ({
  id,
  children,
}: {
  id: DocumentId;
  children: (article: TemplateDocument) => React.ReactNode;
}) => {
  /*
  const templates = Object.values(FIELDS).map((el) => getTemplateDocumentId(el.id));
  const defaultTemplate = templates.find((el) => el === id);
  if (defaultTemplate) return <>{children(defaultTemplate)}</>;
  */
  let { article } = useArticle(id);
  if (!article) return null;
  return <>{children(article)}</>;
};
