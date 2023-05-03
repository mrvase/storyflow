import React from "react";
import type { DocumentId, FieldId } from "@storyflow/shared/types";
import type {
  FieldConfig,
  SyntaxTreeRecord,
} from "@storyflow/fields-core/types";
import type {
  PartialFieldConfig,
  TemplateRef,
  DocumentConfig,
  DocumentVersionRecord,
} from "@storyflow/db-core/types";
import { usePush } from "../collab/CollabContext";
import { getFieldConfig, setFieldConfig } from "operations/field-config";
import { createPurger, createStaticStore } from "../state/StaticStore";
import { useDocument } from ".";
import {
  getDocumentId,
  getTemplateDocumentId,
  isTemplateField,
  replaceDocumentId,
  revertTemplateFieldId,
} from "@storyflow/fields-core/ids";
import { useCollaborativeState } from "../collab/useCollaborativeState";
import { useTemplatePath } from "./TemplatePathContext";
import { DocumentTransactionEntry } from "operations/actions_new";
import { isSpliceOperation, isToggleOperation } from "@storyflow/collab/utils";
import { QueueForEach } from "@storyflow/collab/Queue";

/*
export const labels = createStaticStore<
  string | undefined,
  Map<string, string | undefined>
>(() => new Map());

export const labelsPurger = createPurger((templateId: string) => {
  labels.deleteMany((id) => {
    return id.startsWith(templateId);
  });
});
*/

export const configs = createStaticStore<
  DocumentConfig,
  Map<string, DocumentConfig>
>(() => new Map());

export const templatesPurger = createPurger((key: string) => {
  configs.deleteOne(key);
});

export const useDocumentConfig = (
  templateId: DocumentId, // template id
  data: {
    record: SyntaxTreeRecord;
    config: DocumentConfig;
    versions: DocumentVersionRecord;
  }
) => {
  const operator = React.useCallback(
    (forEach: QueueForEach<DocumentTransactionEntry>) => {
      let newTemplate = [...data.config];

      forEach(({ transaction }) => {
        transaction.forEach((entry) => {
          const target = entry[0];
          entry[1].forEach((operation) => {
            if (isSpliceOperation(operation)) {
              // reordering of fields
              const [index, remove, insert] = operation;
              newTemplate.splice(index, remove ?? 0, ...(insert ?? []));
            } else if (isToggleOperation(operation)) {
              // changing properties
              const fieldId = target as FieldId;
              // TODO: it is now possible to set an overwriting config for template fields.
              // if the overwriting config has not been set before, there is no property
              // for it. So we need to create the property with an array, and add
              // the config to the array with id, if it is not yet present. Then
              // we can set it.

              const [name, value] = operation;

              if (isTemplateField(fieldId)) {
                const templateId = getTemplateDocumentId(fieldId);
                const templateConfig = newTemplate.find(
                  (config): config is TemplateRef =>
                    "template" in config && config.template === templateId
                );
                if (templateConfig) {
                  if (!("config" in templateConfig)) {
                    templateConfig.config = [];
                  }
                  let fieldConfigIndex = templateConfig.config!.findIndex(
                    (config) => config.id === fieldId
                  );
                  if (fieldConfigIndex < 0) {
                    templateConfig.config!.push({ id: fieldId });
                    fieldConfigIndex = templateConfig.config!.length - 1;
                  }
                  if (name === "label" && value === "") {
                    delete templateConfig.config![fieldConfigIndex][name];
                  } else {
                    templateConfig.config![fieldConfigIndex] = {
                      ...templateConfig.config![fieldConfigIndex],
                      [name]: value,
                    };
                  }
                }
              }

              newTemplate = setFieldConfig(newTemplate, fieldId, (ps) => ({
                ...ps,
                [name]: value,
              }));
            }
          });
        });
      });

      return newTemplate;
    },
    [data.config]
  );

  const state = useCollaborativeState(
    (callback) => configs.useKey(templateId, callback),
    operator,
    {
      timelineId: templateId,
      queueId: "config",
    }
  );

  React.useEffect(() => {
    return templatesPurger(templateId);
  }, []);

  return state;
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
  const documentId = getDocumentId<DocumentId>(fieldId);
  const path = useTemplatePath();
  // removing the first element which is just the current document
  const reversedParentPath = path.slice(1).reverse();

  const useConfig = (fieldId: FieldId, options: { reactive?: boolean }) => {
    const { doc: template } = useDocument(getDocumentId(fieldId) as DocumentId);
    let config: PartialFieldConfig | undefined;
    if (options.reactive) {
      [config] = configs.useKey(documentId, undefined, (value) => {
        if (!value) return;
        return getFieldConfig(value, fieldId);
      });
    }
    return config ?? getFieldConfig(template?.config ?? [], fieldId);
  };

  let config: FieldConfig;
  if (path.length === 1) {
    config = useConfig(fieldId, { reactive: true }) as FieldConfig;
  } else {
    // the template
    const templateFieldId = revertTemplateFieldId(fieldId); // documentId === reversedParentPath[0];
    config = useConfig(templateFieldId, { reactive: false }) as FieldConfig;

    // removing the first element (the original) which is handled above
    reversedParentPath.slice(1).forEach((templateId) => {
      const id = replaceDocumentId(fieldId, templateId);
      let overwritingConfig = useConfig(id, { reactive: false });
      config = React.useMemo(
        () => ({ ...(config ?? {}), ...(overwritingConfig ?? {}) }),
        [config, overwritingConfig]
      );
    });

    let reactiveConfig = useConfig(fieldId, { reactive: true });
    config = React.useMemo(
      () => ({ ...(config ?? {}), ...(reactiveConfig ?? {}) }),
      [config, reactiveConfig]
    );
  }

  const push = usePush<DocumentTransactionEntry>(documentId, "config");

  const setter = React.useCallback(
    <Name extends keyof FieldConfig>(
      name: Name,
      payload:
        | FieldConfig[Name]
        | ((ps: FieldConfig[Name] | undefined) => FieldConfig[Name])
        | undefined
    ) => {
      // if (!isNative) return;
      const value =
        typeof payload === "function" ? payload(config?.[name]) : payload;
      push([[fieldId, [[name, value as any]]]]);
    },
    [config, push]
  );

  return [config, setter];
}

export function useLabel(fieldId: FieldId) {
  const [config] = useFieldConfig(fieldId);

  return config?.label ?? "";
}
