import type { DocumentId } from "@storyflow/shared/types";
import React from "react";

const TemplatePathContext = React.createContext<DocumentId[]>([]);

export const ExtendTemplatePath = ({
  children,
  template,
}: {
  children: React.ReactNode;
  template: DocumentId;
}) => {
  const current = React.useContext(TemplatePathContext);
  const next = React.useMemo(() => [...current, template], [current, template]);

  return (
    <TemplatePathContext.Provider value={next}>
      {children}
    </TemplatePathContext.Provider>
  );
};

export const useTemplatePath = () => React.useContext(TemplatePathContext);
