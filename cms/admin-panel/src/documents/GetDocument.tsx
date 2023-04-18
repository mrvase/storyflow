import React from "react";
import { DocumentId, TemplateDocument } from "@storyflow/backend/types";
import { useDocument } from ".";

export const GetDocument = ({
  id,
  children,
}: {
  id: DocumentId;
  children: (doc: TemplateDocument) => React.ReactNode;
}) => {
  let { doc } = useDocument(id);
  if (!doc) return null;
  return <>{children(doc)}</>;
};
