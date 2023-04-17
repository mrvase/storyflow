import React from "react";
import {
  DocumentConfig,
  DocumentId,
  FieldConfig,
  FieldId,
  PartialFieldConfig,
  TemplateRef,
} from "@storyflow/backend/types";
import { useDocumentCollab, useDocumentMutate } from "./DocumentCollabContext";
import { getFieldConfig, setFieldConfig } from "shared/getFieldConfig";
import { createPurger, createStaticStore } from "../../state/StaticStore";
import { useDocument } from "..";
import {
  getDocumentId,
  getTemplateDocumentId,
  isTemplateField,
  replaceDocumentId,
  revertTemplateFieldId,
} from "@storyflow/backend/ids";
import { ServerPackage } from "@storyflow/state";
import { createCollaborativeState } from "../../state/createCollaborativeState";
import { QueueListenerParam } from "@storyflow/state/collab/Queue";
import { useTemplatePath } from "../TemplatePathContext";
import {
  DocumentOperation,
  isSpliceAction,
  isToggleAction,
} from "shared/operations";

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
    history?: ServerPackage<DocumentOperation>[];
    version?: number;
  }
) => {
  React.useEffect(() => {
    return templatesPurger(templateId);
  }, []);

  let { mutate } = useDocument(templateId);

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
    ({ forEach }: QueueListenerParam<DocumentOperation>) => {
      let newTemplate = [...data.config];

      forEach(({ operation }) => {
        const [target, ops] = operation;
        ops.forEach((action) => {
          if (isSpliceAction(action)) {
            // reordering of fields
            const { index, insert, remove } = action;
            newTemplate.splice(index, remove ?? 0, ...(insert ?? []));
          } else if (isToggleAction(action)) {
            // changing properties
            const fieldId = target as FieldId;
            // TODO: it is now possible to set an overwriting config for template fields.
            // if the overwriting config has not been set before, there is no property
            // for it. So we need to create the property with an array, and add
            // the config to the array with id, if it is not yet present. Then
            // we can set it.

            if (isTemplateField(fieldId)) {
              console.log("UPDATE TEMPLATE FIELD", fieldId);
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
                if (action.name === "label" && action.value === "") {
                  delete templateConfig.config![fieldConfigIndex][action.name];
                } else {
                  templateConfig.config![fieldConfigIndex] = {
                    ...templateConfig.config![fieldConfigIndex],
                    [action.name]: action.value,
                  };
                }
              }
            }

            newTemplate = setFieldConfig(newTemplate, fieldId, (ps) => ({
              ...ps,
              [action.name]: action.value,
            }));
          }
        });
      });

      return newTemplate;
    },
    [data.config]
  );

  const state = createCollaborativeState(
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
  const documentId = getDocumentId(fieldId);
  const path = useTemplatePath();
  // removing the first element which is just the current document
  const reversedParentPath = path.slice(1).reverse();

  const useConfig = (fieldId: FieldId, options: { reactive?: boolean }) => {
    const { article: template } = useDocument(
      getDocumentId(fieldId) as DocumentId
    );
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

  /*
  let config: FieldConfig | undefined;
  if (isNative) {
    [config] = configs.useKey(documentId, undefined, (value) => {
      if (!value) return;
      return getFieldConfig(value, fieldId);
    });
  } else {
    // should not update reactively
    const id = revertTemplateFieldId(fieldId);
    const { article: template } = useDocument(templateDocumentId);
    config = template?.config?.find(
      (el): el is FieldConfig => "id" in el && el.id === id
    );
  }
  */

  const { push } = useDocumentMutate<DocumentOperation>(documentId, documentId);

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
      push([
        fieldId,
        [
          {
            name,
            value,
          },
        ],
      ]);
    },
    [config, push]
  );

  return [config, setter];
}

export function useLabel(fieldId: FieldId) {
  const [config] = useFieldConfig(fieldId);

  return config?.label ?? "";
}

/*
export function useLabel(
  fieldId: FieldId | RawFieldId,
  overwritingTemplate?: DocumentId
) {
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
  const { article } = useDocument(templateId);

  const initialLabel = React.useMemo(() => {
    if (!article) {
      return undefined;
    }
    return getFieldConfig(article.config, originalFieldId)?.label;
  }, [article]);

  return label ?? initialLabel ?? "";
}
*/
