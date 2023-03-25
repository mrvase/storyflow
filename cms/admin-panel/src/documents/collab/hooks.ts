import React from "react";
import {
  DocumentConfig,
  DocumentId,
  FieldConfig,
  FieldId,
  RawFieldId,
} from "@storyflow/backend/types";
import { useDocumentCollab, useDocumentMutate } from "./DocumentCollabContext";
import { PropertyOp, targetTools, DocumentConfigOp } from "shared/operations";
import { getFieldConfig, setFieldConfig } from "shared/getFieldConfig";
import { createPurger, createStaticStore } from "../../state/StaticStore";
import { useArticle } from "..";
import {
  getDocumentId,
  getTemplateDocumentId,
  isTemplateField,
  revertTemplateFieldId,
} from "@storyflow/backend/ids";
import { ServerPackage } from "@storyflow/state";
import { createCollaborativeState } from "../../state/createCollaborativeState";
import { QueueListenerParam } from "@storyflow/state/collab/Queue";

/*
export const labels = createStaticStore<
  string | undefined,
  Map<string, string | undefined>
>(() => new Map());
*/

export const configs = createStaticStore<
  DocumentConfig,
  Map<string, DocumentConfig>
>(() => new Map());

/*
export const labelsPurger = createPurger((templateId: string) => {
  labels.deleteMany((id) => {
    return id.startsWith(templateId);
  });
});
*/

export const templatesPurger = createPurger((key: string) => {
  configs.deleteOne(key);
});

export const useDocumentConfig = (
  templateId: DocumentId, // template id
  data: {
    config: DocumentConfig;
    history?: ServerPackage<DocumentConfigOp | PropertyOp>[];
    version?: number;
  }
) => {
  /*
  if (!config && data.config) {
    setConfig(data.config);
  }
  */

  React.useEffect(() => {
    return templatesPurger(templateId);
  }, []);

  /*
  React.useEffect(() => {
    return labelsPurger(templateId);
  }, []);
  */

  let { mutate } = useArticle(templateId);

  const refreshed = React.useRef(false);

  let refreshOnVersionChange = React.useCallback(() => {
    if (!refreshed.current) {
      // TODO
      // this exists to mutate doc when queue registers that a document
      // has been saved, but the current client still uses an earlier document.
      // However, right now it only check up against the version of the
      // current client. CIRCULAR! IT DOES NOT MAKE SENSE!
      refreshed.current = true;
      mutate();
    }
  }, []); // does not need dependency since it is unmounted on version change

  const collab = useDocumentCollab();

  const operator = React.useCallback(
    ({ forEach }: QueueListenerParam<DocumentConfigOp | PropertyOp>) => {
      let newTemplate = [...data.config];

      forEach(({ operation }) => {
        if (targetTools.isOperation(operation, "document-config")) {
          operation.ops.forEach((action) => {
            // reordering of fields
            const { index, insert, remove } = action;
            newTemplate.splice(index, remove ?? 0, ...(insert ?? []));
          });
        } else if (targetTools.isOperation(operation, "property")) {
          // changing label
          const fieldId = targetTools.getLocation(operation.target) as FieldId;
          operation.ops.forEach((action) => {
            newTemplate = setFieldConfig(newTemplate, fieldId, (ps) => ({
              ...ps,
              [action.name]: action.value,
            }));
          });
        }
      });

      return newTemplate;
    },
    [data.config]
  );

  return createCollaborativeState(
    collab,
    (callback) => configs.useKey(templateId, callback),
    operator,
    {
      version: data.version ?? 0,
      history: data.history ?? [],
      document: templateId,
      key: templateId,
    },
    {
      onInvalidVersion: refreshOnVersionChange,
    }
  );
};

export function useFieldConfig(
  fieldId: FieldId
): [
  FieldConfig | undefined,
  <Name extends keyof FieldConfig>(
    name: Name,
    payload:
      | FieldConfig[Name]
      | ((ps: FieldConfig[Name] | undefined) => FieldConfig[Name])
  ) => void
] {
  const documentId = getDocumentId(fieldId);
  const templateDocumentId = getTemplateDocumentId(fieldId);

  const isNative = !isTemplateField(fieldId);

  let config: FieldConfig | undefined;

  if (isNative) {
    [config] = configs.useKey(documentId, undefined, (value) => {
      if (!value) return;
      return getFieldConfig(value, fieldId);
    });
  } else {
    /* should not update reactively */
    const id = revertTemplateFieldId(fieldId);
    const { article: template } = useArticle(templateDocumentId);
    config = template?.config?.find(
      (el): el is FieldConfig => "id" in el && el.id === id
    );
  }

  const { push } = useDocumentMutate<PropertyOp>(documentId, documentId);

  const setter = React.useCallback(
    <Name extends keyof FieldConfig>(
      name: Name,
      payload:
        | FieldConfig[Name]
        | ((ps: FieldConfig[Name] | undefined) => FieldConfig[Name])
        | undefined
    ) => {
      if (!isNative) return;
      const value =
        typeof payload === "function" ? payload(config?.[name]) : payload;
      push({
        target: targetTools.stringify({
          operation: "property",
          location: fieldId,
        }),
        ops: [
          {
            name,
            value,
          },
        ],
      });
    },
    [config, push]
  );

  return [config, setter];
}

export function useLabel(
  fieldId: FieldId | RawFieldId,
  overwritingTemplate?: DocumentId
) {
  /* the updated label */
  const originalFieldId = revertTemplateFieldId(fieldId, overwritingTemplate);
  const documentId = getDocumentId(originalFieldId);

  const [config] = configs.useKey(documentId);

  const label = React.useMemo(() => {
    if (!config) {
      return undefined;
    }
    return getFieldConfig(config, originalFieldId)?.label;
  }, [config]);

  const templateId = getDocumentId(originalFieldId) as DocumentId;
  const { article } = useArticle(templateId);

  const initialLabel = React.useMemo(() => {
    if (!article) {
      return undefined;
    }
    return getFieldConfig(article.config, originalFieldId)?.label;
  }, [article]);

  return label ?? initialLabel ?? "";
}
