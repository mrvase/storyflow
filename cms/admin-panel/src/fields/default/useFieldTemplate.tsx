import React from "react";
import { useArticleTemplate } from "../../documents";
import { getTemplateFieldsAsync } from "../../documents/template-fields";
import { DocumentId, FieldConfig, FieldId } from "@storyflow/backend/types";
import { useFieldConfig } from "../../documents/collab/hooks";
import { useClient } from "../../client";

export const useTemplate = (templateId: DocumentId | undefined) => {
  const article = useArticleTemplate(templateId);
  const [template, setTemplate] = React.useState<FieldConfig[]>();

  const client = useClient();

  React.useLayoutEffect(() => {
    if (!article) return;
    (async () => {
      const fields = await getTemplateFieldsAsync(article.config, client);
      setTemplate(fields);
    })();
  }, [article]);

  return template;
};

export const useFieldTemplate = (id: FieldId) => {
  const [config] = useFieldConfig(id);
  return useTemplate(config?.template);
};
