import React from "react";
import { getTemplateFieldsAsync } from "../../documents/template-fields";
import { DocumentId, FieldConfig, FieldId } from "@storyflow/backend/types";
import { useFieldConfig } from "../../documents/collab/hooks";
import { useClient } from "../../client";
import { useArticle } from "../../documents";

// TODO - make sure all templates are fetched and then make this sync!

export const useTemplate = (templateId: DocumentId | undefined) => {
  const { article } = useArticle(templateId);

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
