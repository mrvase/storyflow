import React from "react";
import { getTemplateFieldsAsync } from "../../documents/template-fields";
import { DocumentId, FieldConfig, FieldId } from "@storyflow/backend/types";
import { useFieldConfig } from "../../documents/collab/hooks";
import { useClient } from "../../client";
import { useDocument } from "../../documents";

// TODO - make sure all templates are fetched and then make this sync!

export const useTemplate = (templateId: DocumentId | undefined) => {
  const { doc } = useDocument(templateId);

  const [template, setTemplate] = React.useState<FieldConfig[]>();

  const client = useClient();

  React.useLayoutEffect(() => {
    if (!doc) return;
    (async () => {
      const fields = await getTemplateFieldsAsync(doc.config, client);
      setTemplate(fields);
    })();
  }, [doc]);

  return template;
};

export const useFieldTemplate = (id: FieldId) => {
  const [config] = useFieldConfig(id);
  return useTemplate(config?.template);
};
