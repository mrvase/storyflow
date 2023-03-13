import React from "react";
import {
  DocumentConfig,
  DocumentId,
  FieldConfig,
  FieldId,
} from "@storyflow/backend/types";
import { useDocumentCollab } from "./DocumentCollabContext";
import { PropertyOp, targetTools, DocumentConfigOp } from "shared/operations";
import { getFieldConfig, setFieldConfig } from "shared/getFieldConfig";
import { createPurger, createStaticStore } from "../../state/StaticStore";
import { useSingular } from "../../state/useSingular";
import { useArticle, useArticleTemplate } from "..";
import {
  computeFieldId,
  getDocumentId,
  getRawFieldId,
  getTemplateDocumentId,
} from "@storyflow/backend/ids";
import { ServerPackage } from "@storyflow/state";

export const labels = createStaticStore<
  string | undefined,
  Map<string, string | undefined>
>(() => new Map());

export const configs = createStaticStore<
  DocumentConfig,
  Map<string, DocumentConfig>
>(() => new Map());

export const labelsPurger = createPurger((templateId: string) => {
  labels.deleteMany((id) => {
    return id.startsWith(templateId);
  });
});

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
  const [config, setConfig] = configs.useKey(templateId, data.config);
  /*
  if (!config && data.config) {
    setConfig(data.config);
  }
  */

  React.useEffect(() => {
    return templatesPurger(templateId);
  }, []);

  React.useEffect(() => {
    return labelsPurger(templateId);
  }, []);

  let { mutate } = useArticle(templateId);

  const refreshed = React.useRef(false);

  let refreshOnVersionChange = React.useCallback((version: number | null) => {
    if (version !== data.version) {
      if (!refreshed.current) {
        mutate();
        refreshed.current = true;
      }
      return true;
    }
    return false;
  }, []); // does not need dependency since it is unmounted on version change

  const singular = useSingular(templateId);

  const collab = useDocumentCollab();

  React.useEffect(() => {
    const queue = collab
      .getOrAddQueue<DocumentConfigOp | PropertyOp>(templateId, templateId, {
        transform: (pkgs) => pkgs,
      })
      .initialize(data.version ?? 0, data.history ?? []);

    return queue.register(({ forEach, version }) => {
      singular(() => {
        if (refreshOnVersionChange(version)) {
          return;
        }

        let sheetUpdate = false;
        const updatedLabels = new Map<string, string>();

        let newTemplate = [...data.config];

        forEach(({ operation }) => {
          if (targetTools.isOperation(operation, "document-config")) {
            operation.ops.forEach((action) => {
              // reordering of fields
              const { index, insert, remove } = action;
              newTemplate.splice(index, remove ?? 0, ...(insert ?? []));
              (insert ?? []).forEach((el) => {
                if ("label" in el) {
                  updatedLabels.set(el.id, el.label);
                }
              });
            });
            sheetUpdate = true;
          } else if (targetTools.isOperation(operation, "property")) {
            // changing label
            const fieldId = targetTools.getLocation(
              operation.target
            ) as FieldId;
            operation.ops.forEach((action) => {
              newTemplate = setFieldConfig(newTemplate, fieldId, (ps) => ({
                ...ps,
                [action.name]: action.value,
              }));
              sheetUpdate = true;
              if (action.name === "label") {
                updatedLabels.set(fieldId, action.value);
              }
            });
          }
        });

        if (sheetUpdate) {
          setConfig(newTemplate);
        }

        updatedLabels.forEach((value, key) => {
          labels.set(key, value);
        });
      });
    });
  }, []);

  return config ?? data.config;
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

  const isNative = documentId === templateDocumentId;

  let config: FieldConfig | undefined;

  if (isNative) {
    [config] = configs.useKey(templateDocumentId, undefined, (value) => {
      if (!value) return;
      return getFieldConfig(value, fieldId);
    });
  } else {
    /* should not update reactively */
    const id = computeFieldId(templateDocumentId, getRawFieldId(fieldId));
    const template = useArticleTemplate(templateDocumentId);
    config = template?.config?.find(
      (el): el is FieldConfig => "id" in el && el.id === id
    );
  }

  const { push } = useDocumentCollab().mutate<PropertyOp>(
    documentId,
    documentId
  );

  const setter = <Name extends keyof FieldConfig>(
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
  };

  return [config, setter];
}

export function useLabel(fieldId: FieldId, overwritingTemplate?: DocumentId) {
  /* the updated label */
  const [label] = labels.useKey(fieldId);

  const templateId = overwritingTemplate ?? getTemplateDocumentId(fieldId);
  const article = useArticleTemplate(templateId);

  const initialLabel = React.useMemo(() => {
    if (!article) {
      return undefined;
    }
    return getFieldConfig(article.config, fieldId)?.label;
  }, [article]);

  return label ?? initialLabel ?? "";
}
