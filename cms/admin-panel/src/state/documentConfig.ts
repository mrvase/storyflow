import { handleServerPackageArray, ServerPackageArray } from "@storyflow/state";
import React from "react";
import { DocumentConfig, FieldConfig, FieldId } from "@storyflow/backend/types";
import { useCollab } from "./collaboration";
import { PropertyOp, targetTools, DocumentConfigOp } from "shared/operations";
import { getFieldConfig, setFieldConfig } from "shared/getFieldConfig";
import { createPurger, createStaticStore } from "./StaticStore";
import { useSingular } from "./state";
import { useArticle, useArticleTemplate } from "../articles";
import { getTemplateDocumentId } from "@storyflow/backend/ids";

export const labels = createStaticStore(new Map<string, string | undefined>());

export const configs = createStaticStore(new Map<string, DocumentConfig>());

export const labelsPurger = createPurger((templateId: string) => {
  labels.deleteMany((id) => {
    return id.startsWith(templateId);
  });
});

export const templatesPurger = createPurger((key: string) => {
  configs.deleteOne(key);
});

export const useDocumentConfig = (
  templateId: string, // template id
  initialConfig: DocumentConfig,
  initialHistory: ServerPackageArray<DocumentConfigOp | PropertyOp>
) => {
  const [config, setConfig] = configs.useKey(templateId);
  if (!config && initialConfig) {
    setConfig(initialConfig);
  }

  React.useEffect(() => {
    return templatesPurger(templateId);
  }, []);

  React.useEffect(() => {
    return labelsPurger(templateId);
  }, []);

  let { mutate } = useArticle(templateId);

  const refreshed = React.useRef(false);

  let refreshOnVersionChange = React.useCallback((version: number | null) => {
    if (version !== initialVersion) {
      if (!refreshed.current) {
        mutate();
        refreshed.current = true;
      }
      return true;
    }
    return false;
  }, []); // does not need dependency since it is unmounted on version change

  const [initialVersion] = handleServerPackageArray(initialHistory);

  const singular = useSingular(templateId);

  const collab = useCollab();

  React.useEffect(() => {
    const queue = collab
      .getOrAddQueue<DocumentConfigOp | PropertyOp>(templateId, templateId, {
        transform: (pkgs) => pkgs,
      })
      .initialize(initialHistory ?? []);

    return queue.register(({ forEach, version }) => {
      singular(() => {
        if (refreshOnVersionChange(version)) {
          return;
        }

        let sheetUpdate = false;
        const updatedLabels = new Map<string, string>();

        let newTemplate = [...initialConfig];

        forEach(({ operation }) => {
          if (targetTools.isOperation(operation, "document-config")) {
            operation.ops.forEach((action) => {
              // reordering of fields
              const { index, insert, remove } = action;
              newTemplate.splice(index, remove ?? 0, ...(insert ?? []));
            });
            sheetUpdate = true;
          } else if (targetTools.isOperation(operation, "property")) {
            // changing label
            const fieldId = targetTools.getLocation(operation.target);
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

  return config ?? initialConfig;
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
  const templateId = getTemplateDocumentId(fieldId);

  const [config] = configs.useKey(templateId, (value) => {
    if (!value) return;
    return getFieldConfig(value, fieldId);
  });

  const { push } = useCollab().mutate<PropertyOp>(
    fieldId.slice(0, 4),
    fieldId.slice(0, 4)
  );

  const setter = <Name extends keyof FieldConfig>(
    name: Name,
    payload:
      | FieldConfig[Name]
      | ((ps: FieldConfig[Name] | undefined) => FieldConfig[Name])
  ) => {
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

export function useLabel(fieldId: string) {
  /* the updated label */
  const [label] = labels.useKey(fieldId);

  const templateId = fieldId.slice(4, 8);
  const article = useArticleTemplate(templateId);

  const initialLabel = React.useMemo(() => {
    if (!article) {
      return undefined;
    }
    return getFieldConfig(article.config, fieldId)?.label;
  }, [article]);

  return label ?? initialLabel ?? "";
}
