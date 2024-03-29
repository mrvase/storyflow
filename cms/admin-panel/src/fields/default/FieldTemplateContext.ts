import React from "react";
import type { DocumentId, RawDocumentId } from "@storyflow/shared/types";

export const FieldTemplateIdContext = React.createContext<
  DocumentId | RawDocumentId | null
>(null);

export const useFieldTemplateId = () =>
  React.useContext(FieldTemplateIdContext);
