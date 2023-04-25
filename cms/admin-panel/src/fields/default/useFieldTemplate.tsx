import React from "react";
import { getTemplateFieldsAsync } from "../../documents/template-fields";
import { DocumentId, RawDocumentId } from "@storyflow/shared/types";
import { FieldConfig } from "@storyflow/fields-core/types";
import { useClient } from "../../client";
import { useDocument } from "../../documents";

// TODO - make sure all templates are fetched and then make this sync!

export const useTemplate = (
  templateId: RawDocumentId | DocumentId | null | undefined
) => {
  const { doc } = useDocument(templateId ?? undefined);

  const [template, setTemplate] = React.useState<FieldConfig[]>();

  const client = useClient();

  React.useLayoutEffect(() => {
    if (!doc) {
      setTemplate(undefined);
    } else {
      (async () => {
        const fields = await getTemplateFieldsAsync(doc.config, client);
        setTemplate(fields);
      })();
    }
  }, [doc]);

  return template;
};
