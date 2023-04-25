import React from "react";
import type { DocumentId } from "@storyflow/shared/types";
import type { DBDocument } from "@storyflow/db-core/types";
import { useDocument } from ".";

export const GetDocument = ({
  id,
  children,
}: {
  id: DocumentId;
  children: (doc: DBDocument) => React.ReactNode;
}) => {
  let { doc } = useDocument(id);
  if (!doc) return null;
  return <>{children(doc)}</>;
};
