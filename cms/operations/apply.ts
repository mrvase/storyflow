import type { FieldId } from "@storyflow/shared/types";
import type {
  SyntaxTreeRecord,
  FieldTransform,
} from "@storyflow/fields-core/types";
import type { TokenStream } from "./types";
import { FieldOperation, isSpliceAction, isToggleAction } from "./actions";
import { tools } from "./stream-methods";
import { createSpliceTransformer } from "./splice-transform";
import { createTokenStream } from "./parse-token-stream";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/fields-core/constants";
import { DocumentTransactionEntry, FieldTransactionEntry } from "./actions_new";
import { isSpliceOperation, isToggleOperation } from "@storyflow/collab/utils";
import { DocumentConfig, TemplateRef } from "@storyflow/db-core/types";
import {
  isTemplateField,
  getTemplateDocumentId,
} from "@storyflow/fields-core/ids";
import { setFieldConfig } from "./field-config";

/*
export const applyFieldOperation = (
  state: { stream: TokenStream; transforms: FieldTransform[] },
  operation: FieldOperation
): { stream: TokenStream; transforms: FieldTransform[] } => {
  let newStream = state.stream;
  let newTransforms = state.transforms;
  let removed: TokenStream = [];
  operation[1].forEach((action) => {
    if (isSpliceAction(action)) {
      const { index, insert = [], remove = 0 } = action;
      const move = !action.insert && !action.remove;
      if (move) {
        newStream = tools.concat(
          tools.slice(newStream, 0, index),
          removed,
          tools.slice(newStream, index)
        );
      } else {
        if (remove > 0) {
          const currentlyRemoved = tools.slice(
            newStream,
            index,
            index + remove
          );
          removed.push(...currentlyRemoved);
          const slice1 = tools.slice(newStream, 0, index);
          const slice2 = tools.slice(newStream, index + remove);
          newStream = tools.concat(slice1, slice2);
        }
        if (insert.length > 0 && !(insert.length === 1 && insert[0] === "")) {
          newStream = tools.concat(
            tools.slice(newStream, 0, index),
            insert,
            tools.slice(newStream, index)
          );
        }
      }
    } else if (isToggleAction(action)) {
      const index = newTransforms.findIndex((t) => t.type === action.name);
      if (index >= 0) {
        if (action.value === null) {
          // delete
          newTransforms.splice(index, 1);
        } else {
          // update
          newTransforms[index] = {
            type: action.name,
            ...(action.value !== true && { data: action.value }),
          };
        }
      } else {
        if (action.value !== null) {
          // create
          newTransforms.push({
            type: action.name,
            ...(action.value !== true && { data: action.value }),
          });
        }
      }
      // TODO
    }
  });

  return {
    stream: newStream,
    transforms: newTransforms,
  };
};
*/

export const applyFieldTransaction = (
  state: { stream: TokenStream; transforms: FieldTransform[] },
  transaction: FieldTransactionEntry
): { stream: TokenStream; transforms: FieldTransform[] } => {
  let newStream = state.stream;
  let newTransforms = state.transforms;
  let removed: TokenStream = [];
  transaction[1].forEach((operation) => {
    if (isSpliceOperation(operation)) {
      const [index, remove = 0, insert = []] = operation;
      const move = !insert.length && !remove;
      if (move) {
        newStream = tools.concat(
          tools.slice(newStream, 0, index),
          removed,
          tools.slice(newStream, index)
        );
      } else {
        if (remove > 0) {
          const currentlyRemoved = tools.slice(
            newStream,
            index,
            index + remove
          );
          removed.push(...currentlyRemoved);
          const slice1 = tools.slice(newStream, 0, index);
          const slice2 = tools.slice(newStream, index + remove);
          newStream = tools.concat(slice1, slice2);
        }
        if (insert.length > 0 && !(insert.length === 1 && insert[0] === "")) {
          newStream = tools.concat(
            tools.slice(newStream, 0, index),
            insert,
            tools.slice(newStream, index)
          );
        }
      }
    } else if (isToggleOperation(operation)) {
      const [name, value] = operation;
      const index = newTransforms.findIndex((t) => t.type === name);
      if (index >= 0) {
        if (value === null) {
          // delete
          newTransforms.splice(index, 1);
        } else {
          // update
          newTransforms[index] = {
            type: name,
            ...(value !== true && { data: value }),
          };
        }
      } else {
        if (value !== null) {
          // create
          newTransforms.push({
            type: name,
            ...(value !== true && { data: value }),
          });
        }
      }
      // TODO
    }
  });

  return {
    stream: newStream,
    transforms: newTransforms,
  };
};

export const applyConfigTransaction = (
  config: DocumentConfig,
  transaction: DocumentTransactionEntry
) => {
  let newConfig = config;

  const target = transaction[0];
  transaction[1].forEach((operation) => {
    if (isSpliceOperation(operation)) {
      const [index, remove, insert] = operation;
      newConfig.splice(index, remove ?? 0, ...(insert ?? []));
    } else if (isToggleOperation(operation)) {
      const fieldId = target as FieldId;

      const [name, value] = operation;

      if (isTemplateField(fieldId)) {
        const templateId = getTemplateDocumentId(fieldId);
        const templateConfig = newConfig.find(
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

      newConfig = setFieldConfig(newConfig, fieldId, (ps) => ({
        ...ps,
        [name]: value,
      }));
    }
  });

  return newConfig;
};

export const createDocumentTransformer = (initial: {
  config: DocumentConfig;
  record: SyntaxTreeRecord;
}) => {
  const getInitialLength = (target: string) => {
    if (target === "config") {
      return initial.config.length;
    }
    const id = target as FieldId;
    let value = createTokenStream(initial.record[id] ?? DEFAULT_SYNTAX_TREE);
    return tools.getLength(value);
  };
  return createSpliceTransformer(getInitialLength, (target, value) => {
    if (target === "config") {
      return value.length;
    }
    return tools.getLength(value);
  });
};
